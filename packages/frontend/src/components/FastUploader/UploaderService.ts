import {
  ChunkInfo,
  FileInfo,
  UploadOptions,
  UploadProgress,
  UploadResponse,
  VerifyResponse,
  UploadError,
} from "@bigupload/shared";

// 直接在本地定义错误类型，避免导入问题
enum UploadErrorType {
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  ABORT_ERROR = "ABORT_ERROR",
  HASH_CALCULATION_ERROR = "HASH_CALCULATION_ERROR",
}

import { WebFileHasher } from "../../utils/hash-calculator";
import { RequestManager } from "../../utils/request";
import { v4 as uuidv4 } from "uuid";

interface TaskItem {
  chunkIndex: number;
  status: "pending" | "uploading" | "success" | "error";
  retryCount: number;
  cancelToken?: any;
}

export class UploaderService {
  private options: UploadOptions;
  private fileInfo: FileInfo | null = null;
  private tasks: TaskItem[] = [];
  private requestManager: RequestManager;
  private fileHasher: WebFileHasher;
  private isRunning = false;
  private isPaused = false;
  private progressListeners: ((progress: UploadProgress) => void)[] = [];
  private errorListeners: ((error: UploadError) => void)[] = [];
  private successListeners: ((response: UploadResponse) => void)[] = [];
  private abortController: AbortController = new AbortController();

  // 性能监控
  private uploadStartTime = 0;
  private loadedBytes = 0;
  private previousLoaded = 0;
  private speedUpdateInterval: NodeJS.Timeout | null = null;

  constructor(options: UploadOptions) {
    // 创建默认选项
    const defaultOptions = {
      chunkSize: 2 * 1024 * 1024, // 默认2MB
      concurrent: 3, // 默认并发数
      retryCount: 3, // 默认重试3次
      retryDelay: 1000, // 重试延迟1秒
    };

    // 合并选项
    this.options = { ...defaultOptions, ...options };

    this.requestManager = new RequestManager(options.url);
    this.fileHasher = new WebFileHasher();
  }

  /**
   * 开始上传流程
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      console.log("开始上传流程", {
        fileName: this.options.file.name,
        fileSize: this.options.file.size,
        chunkSize: this.options.chunkSize,
      });

      this.isRunning = true;
      this.isPaused = false;
      this.abortController = new AbortController();

      // 重置状态
      this.uploadStartTime = Date.now();
      this.loadedBytes = 0;
      this.previousLoaded = 0;

      // 启动性能监控
      this.startPerformanceMonitor();

      // 发送初始进度
      this.emitProgress({
        fileId: "",
        fileName: this.options.file.name,
        loaded: 0,
        total: this.options.file.size,
        percent: 0,
        status: "pending",
        speed: 0,
        remainingTime: 0,
      });

      // 1. 计算文件哈希值
      console.log("开始计算文件哈希...");
      await this.prepareFileInfo();
      console.log("文件哈希计算完成");

      if (!this.fileInfo) throw new Error("Failed to prepare file info");

      // 2. 检查文件是否已存在（秒传功能）
      console.log("开始验证文件是否已存在...");
      const verifyResponse = await this.verifyFile();
      console.log("文件验证完成:", verifyResponse);

      // 文件已存在，直接完成
      if (
        verifyResponse.exists &&
        verifyResponse.fileId &&
        verifyResponse.finish
      ) {
        console.log("文件已存在，执行秒传");
        this.emitProgress({
          fileId: this.fileInfo.fileId,
          fileName: this.fileInfo.fileName,
          loaded: this.options.file.size,
          total: this.options.file.size,
          percent: 100,
          status: "completed",
          speed: 0,
          remainingTime: 0,
        });

        this.emitSuccess({
          success: true,
          fileId: this.fileInfo.fileId,
          url: verifyResponse.url,
          message: "文件已存在，秒传成功",
        });

        this.cleanup();
        return;
      }

      // 3. 初始化上传任务
      console.log("文件不存在，开始初始化上传任务...");
      this.initTasks(verifyResponse.uploadedChunks || []);

      // 4. 执行上传
      console.log("开始执行上传任务...");
      await this.processTasks();
    } catch (error) {
      console.error("上传流程出错:", error);
      this.handleError(error as UploadError);
    }
  }

  /**
   * 暂停上传
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;

    this.isPaused = true;

    // 取消所有正在进行的请求
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = new AbortController();
    }

    // 更新状态为暂停
    if (this.fileInfo) {
      this.emitProgress({
        fileId: this.fileInfo.fileId,
        fileName: this.fileInfo.fileName,
        loaded: this.loadedBytes,
        total: this.options.file.size,
        percent: Math.floor((this.loadedBytes / this.options.file.size) * 100),
        status: "paused",
        speed: 0,
        remainingTime: 0,
      });
    }

    // 停止性能监控
    this.stopPerformanceMonitor();
  }

  /**
   * 继续上传
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;

    this.isPaused = false;

    // 重启性能监控
    this.startPerformanceMonitor();

    // 重新开始上传任务
    this.processTasks();
  }

  /**
   * 取消上传
   */
  cancel(): void {
    if (!this.isRunning) return;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.cleanup();
  }

  /**
   * 添加进度监听器
   */
  onProgress(callback: (progress: UploadProgress) => void): () => void {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * 添加错误监听器
   */
  onError(callback: (error: UploadError) => void): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 添加成功监听器
   */
  onSuccess(callback: (response: UploadResponse) => void): () => void {
    this.successListeners.push(callback);
    return () => {
      this.successListeners = this.successListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * 准备文件信息
   */
  private async prepareFileInfo(): Promise<void> {
    try {
      // 计算文件哈希
      const fileHash = await this.fileHasher.calculateHash(this.options.file);

      // 创建文件信息
      this.fileInfo = {
        fileId: uuidv4(), // 生成唯一ID
        fileName: this.options.file.name,
        fileSize: this.options.file.size,
        fileHash: fileHash,
        fileType: this.options.file.type,
        chunkSize: this.options.chunkSize,
        chunkTotal: Math.ceil(this.options.file.size / this.options.chunkSize), // 分片总数不变，仍然是向上取整
        uploadedChunks: [],
      };

      console.log("文件信息已准备:", {
        fileId: this.fileInfo.fileId,
        fileName: this.fileInfo.fileName,
        fileSize: this.fileInfo.fileSize,
        fileHash: this.fileInfo.fileHash,
        chunkSize: this.fileInfo.chunkSize,
        chunkTotal: this.fileInfo.chunkTotal,
      });
    } catch (error) {
      throw {
        type: UploadErrorType.HASH_CALCULATION_ERROR,
        message: "文件哈希计算失败",
        retryable: false,
      } as UploadError;
    }
  }

  /**
   * 验证文件是否已存在
   */
  private async verifyFile(): Promise<VerifyResponse> {
    if (!this.fileInfo) {
      throw new Error("File info not initialized");
    }

    try {
      console.log("正在验证文件是否存在:", this.fileInfo.fileName);
      console.log("文件信息:", {
        fileId: this.fileInfo.fileId,
        fileHash: this.fileInfo.fileHash,
        fileName: this.fileInfo.fileName,
        fileSize: this.fileInfo.fileSize,
        chunkTotal: this.fileInfo.chunkTotal,
      });

      const response = await this.requestManager.post<VerifyResponse>(
        "/verify",
        {
          fileId: this.fileInfo.fileId,
          fileHash: this.fileInfo.fileHash,
          fileName: this.fileInfo.fileName,
          fileSize: this.fileInfo.fileSize,
        }
      );

      console.log("文件验证响应:", response);

      // 添加success字段，确保与其他接口返回格式一致
      // 文件不存在也是正常情况，所以设置success为true
      return {
        ...response,
        success: true,
        finish: response.finish || false, // 确保有finish字段
      };
    } catch (error) {
      console.error("验证文件失败:", error);

      // 构造一个默认的响应对象
      const defaultResponse: VerifyResponse = {
        exists: false,
        fileId: this.fileInfo.fileId,
        uploadedChunks: [],
        success: true, // 添加success字段，确保与其他接口返回格式一致
        finish: false, // 添加finish字段，默认为false
        message: "无法连接到服务器，将尝试上传",
      };

      // 如果是服务器错误，抛出异常让上层处理
      if ((error as UploadError)?.type === UploadErrorType.SERVER_ERROR) {
        throw error;
      }

      // 如果是网络错误，返回默认响应
      console.log("使用默认响应继续上传:", defaultResponse);
      return defaultResponse;
    }
  }

  /**
   * 初始化上传任务
   */
  private initTasks(uploadedChunks: number[] = []): void {
    if (!this.fileInfo) return;

    console.log(`开始初始化上传任务, 已上传分片数: ${uploadedChunks.length}`);
    console.log("已上传分片索引:", uploadedChunks);
    console.log("文件信息:", {
      fileId: this.fileInfo.fileId,
      fileName: this.fileInfo.fileName,
      fileSize: this.fileInfo.fileSize,
      chunkSize: this.fileInfo.chunkSize,
      chunkTotal: this.fileInfo.chunkTotal,
    });

    this.tasks = [];
    const { chunkTotal } = this.fileInfo;
    console.log(`总分片数: ${chunkTotal}, 类型: ${typeof chunkTotal}`);

    // 创建任务队列 - 从1开始
    for (let i = 1; i <= chunkTotal; i++) {
      // 跳过已上传的分块
      const status = uploadedChunks.includes(i) ? "success" : "pending";
      console.log(
        `创建任务: chunkIndex=${i}, status=${status}, 类型=${typeof i}`
      );

      this.tasks.push({
        chunkIndex: i,
        status,
        retryCount: 0,
      });

      // 如果是已上传的块，更新已加载字节数
      if (status === "success") {
        // 最后一块可能不是完整大小
        const currentChunkSize =
          i === chunkTotal
            ? this.options.file.size % this.options.chunkSize ||
              this.options.chunkSize
            : this.options.chunkSize;

        this.loadedBytes += currentChunkSize;
      }
    }

    // 更新文件信息中的已上传块
    if (this.fileInfo) {
      this.fileInfo.uploadedChunks = [...uploadedChunks];
    }

    console.log(`任务初始化完成, 总任务数: ${this.tasks.length}`);
    console.log(
      `待上传任务数: ${this.tasks.filter((t) => t.status === "pending").length}`
    );
    console.log(
      `已上传任务数: ${this.tasks.filter((t) => t.status === "success").length}`
    );
    console.log(
      `任务列表:`,
      this.tasks.map((t) => ({ chunkIndex: t.chunkIndex, status: t.status }))
    );

    // 更新进度
    this.updateProgress();
  }

  /**
   * 处理上传任务队列
   */
  private async processTasks(): Promise<void> {
    if (this.isPaused || !this.isRunning) return;

    // 获取待处理的任务
    const pendingTasks = this.tasks.filter((task) => task.status === "pending");
    console.log(`处理上传任务队列: 待处理任务数量=${pendingTasks.length}`);

    // 打印所有待处理任务的索引
    if (pendingTasks.length > 0) {
      console.log(
        "待处理任务索引:",
        pendingTasks.map((t) => t.chunkIndex)
      );
    }

    // 所有任务已完成
    if (pendingTasks.length === 0) {
      // 检查是否所有任务都成功
      const allSuccess = this.tasks.every((task) => task.status === "success");
      console.log(`所有任务处理完成，全部成功: ${allSuccess}`);

      if (allSuccess) {
        // 检查是否有正在上传的任务
        const uploadingCount = this.tasks.filter(
          (task) => task.status === "uploading"
        ).length;

        // 只有当没有正在上传的任务时，才合并分片
        if (uploadingCount === 0) {
          console.log("没有待处理和正在上传的任务，开始合并分片");
          // 合并分片
          await this.mergeChunks();
        } else {
          console.log(`还有 ${uploadingCount} 个任务正在上传，暂不合并分片`);
        }
      }
      return;
    }

    // 获取可并发的任务数量
    const availableSlots = Math.min(
      this.options.concurrent || 3,
      pendingTasks.length
    );

    // 获取当前正在上传的任务数
    const uploadingCount = this.tasks.filter(
      (task) => task.status === "uploading"
    ).length;

    // 计算需要启动的新任务数
    const tasksToStart = availableSlots - uploadingCount;
    console.log(
      `当前上传中任务数: ${uploadingCount}, 将启动新任务数: ${tasksToStart}`
    );

    if (tasksToStart <= 0) return;

    // 启动新任务
    const tasksToUpload = pendingTasks.slice(0, tasksToStart);
    console.log(
      `准备启动以下任务: ${tasksToUpload.map((t) => t.chunkIndex).join(", ")}`
    );

    try {
      // 并发启动任务
      await Promise.all(
        tasksToUpload.map((task) => {
          console.log(
            `开始上传任务，chunkIndex=${
              task.chunkIndex
            }，类型=${typeof task.chunkIndex}`
          );
          return this.uploadChunk(task.chunkIndex);
        })
      );

      // 检查是否还有待处理的任务
      const remainingTasks = this.tasks.filter(
        (task) => task.status === "pending"
      );
      if (remainingTasks.length > 0) {
        // 递归处理剩余任务
        await this.processTasks();
      } else {
        // 再次检查是否所有任务都已成功完成
        const allSuccess = this.tasks.every(
          (task) => task.status === "success"
        );
        const uploadingCount = this.tasks.filter(
          (task) => task.status === "uploading"
        ).length;

        if (allSuccess && uploadingCount === 0) {
          console.log("所有任务已成功完成，开始合并分片");
          await this.mergeChunks();
        }
      }
    } catch (error) {
      console.error("处理上传任务队列出错:", error);
      // 继续处理其他任务，不要中断整个上传流程
      const remainingTasks = this.tasks.filter(
        (task) => task.status === "pending"
      );
      if (remainingTasks.length > 0) {
        await this.processTasks();
      }
    }
  }

  /**
   * 上传单个分片
   */
  private async uploadChunk(chunkIndex: number): Promise<void> {
    if (this.isPaused || !this.isRunning || !this.fileInfo) return;

    console.log(`开始上传分片: ${chunkIndex}, 类型: ${typeof chunkIndex}`);

    // 获取任务
    const taskIndex = this.tasks.findIndex((t) => t.chunkIndex === chunkIndex);
    if (taskIndex === -1) {
      console.error(`找不到分片任务: ${chunkIndex}`);
      return;
    }

    // 更新任务状态
    this.tasks[taskIndex].status = "uploading";

    try {
      // 获取分片数据 - 从1开始的索引需要调整
      const { file, chunkSize } = this.options;
      const start = (chunkIndex - 1) * chunkSize; // 调整起始位置
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      const chunkInfo: ChunkInfo = {
        fileId: this.fileInfo.fileId,
        chunkIndex,
        chunkSize,
        chunkTotal: this.fileInfo.chunkTotal,
        currentChunkSize: end - start,
      };

      console.log(
        `准备上传分片: ${chunkIndex}, 大小: ${
          end - start
        }字节, 起始位置: ${start}, 结束位置: ${end}`
      );

      // 上传分片
      const chunkIndexStr = chunkIndex.toString();
      console.log(
        `将chunkIndex转换为字符串: ${chunkIndexStr}, 类型: ${typeof chunkIndexStr}`
      );

      const response = await this.requestManager.uploadChunk<
        UploadResponse & { completed?: boolean }
      >(
        "/upload",
        chunk,
        {
          fileId: this.fileInfo.fileId,
          fileName: this.fileInfo.fileName,
          chunkIndex: chunkIndexStr,
          chunkTotal: this.fileInfo.chunkTotal.toString(),
          fileHash: this.fileInfo.fileHash,
        },
        {
          signal: this.abortController.signal,
          timeout: 120000, // 单个分片上传超时设为2分钟
        },
        this.handleChunkProgress.bind(this, chunkIndex, end - start)
      );

      console.log(`分片 ${chunkIndex} 上传响应:`, response);

      // 检查响应是否成功
      if (!response || response.success === false) {
        throw {
          type: UploadErrorType.SERVER_ERROR,
          message: response?.message || "服务器返回错误",
          retryable: true,
        };
      }

      // 更新任务状态
      this.tasks[taskIndex].status = "success";
      console.log(`分片 ${chunkIndex} 上传成功`);

      // 更新文件信息中的已上传块
      if (this.fileInfo && !this.fileInfo.uploadedChunks.includes(chunkIndex)) {
        this.fileInfo.uploadedChunks.push(chunkIndex);
      }

      // 如果后端返回completed=true，表示所有分片都已上传完成，可以直接合并
      if (response.completed) {
        console.log("所有分片已上传完成，准备合并分片");
        await this.mergeChunks();
        return;
      }

      // 继续处理队列
      this.processTasks();
    } catch (error) {
      console.error(`分片 ${chunkIndex} 上传失败:`, error);

      // 更新任务状态
      if (taskIndex !== -1) {
        const task = this.tasks[taskIndex];
        task.status = "error";

        // 重试逻辑
        if (
          task.retryCount < (this.options.retryCount || 3) &&
          (error as UploadError).retryable !== false
        ) {
          task.retryCount++;
          task.status = "pending";
          console.log(
            `准备重试分片 ${chunkIndex}, 重试次数: ${task.retryCount}`
          );

          // 延迟重试
          setTimeout(() => {
            this.processTasks();
          }, this.options.retryDelay || 1000);
        } else {
          // 重试次数已用尽或不可重试的错误
          this.handleError(error as UploadError);
        }
      }
    }
  }

  /**
   * 处理分片上传进度
   */
  private handleChunkProgress(
    chunkIndex: number,
    chunkSize: number,
    event: any
  ): void {
    if (!event.lengthComputable || !this.fileInfo) return;

    const chunkLoaded = Math.floor((event.loaded / event.total) * chunkSize);

    // 更新已加载的字节数
    const taskIndex = this.tasks.findIndex((t) => t.chunkIndex === chunkIndex);
    if (taskIndex === -1) return;

    // 任务已经成功则不更新进度
    if (this.tasks[taskIndex].status === "success") return;

    // 计算总的已加载字节数 = 已完成分片 + 当前分片的进度
    const completedChunks = this.fileInfo.uploadedChunks.length;
    // 使用 chunkSize 而不是 completedChunks * chunkSize，因为现在索引从1开始
    const completedSize = this.loadedBytes - chunkLoaded;

    this.loadedBytes = completedSize + chunkLoaded;

    // 更新进度
    this.updateProgress();
  }

  /**
   * 更新并发送进度信息
   */
  private updateProgress(): void {
    if (!this.fileInfo) return;

    const { file } = this.options;
    const percent = Math.floor((this.loadedBytes / file.size) * 100);

    this.emitProgress({
      fileId: this.fileInfo.fileId,
      fileName: file.name,
      loaded: this.loadedBytes,
      total: file.size,
      percent,
      status: this.isPaused ? "paused" : "uploading",
      speed: this.calculateSpeed(),
      remainingTime: this.calculateRemainingTime(),
    });
  }

  /**
   * 合并所有分片
   */
  private async mergeChunks(): Promise<void> {
    if (!this.fileInfo) return;

    try {
      console.log("开始合并分片...", this.fileInfo);

      // 发送合并请求
      const response = await this.requestManager.post<UploadResponse>(
        "/merge",
        {
          fileId: this.fileInfo.fileId,
          fileName: this.fileInfo.fileName,
          fileHash: this.fileInfo.fileHash,
          fileSize: this.fileInfo.fileSize,
          chunkSize: this.fileInfo.chunkSize,
          chunkTotal: this.fileInfo.chunkTotal,
          uploadedChunks: this.fileInfo.uploadedChunks,
        },
        {
          signal: this.abortController.signal,
          timeout: 180000, // 合并操作给3分钟超时时间
        }
      );

      // 检查响应是否成功
      if (!response || response.success === false) {
        throw {
          type: UploadErrorType.SERVER_ERROR,
          message: response?.message || "文件合并失败",
          retryable: false,
        };
      }

      console.log("文件合并成功:", response);

      // 更新状态为已完成
      this.emitProgress({
        fileId: this.fileInfo.fileId,
        fileName: this.fileInfo.fileName,
        loaded: this.options.file.size,
        total: this.options.file.size,
        percent: 100,
        status: "completed",
        speed: 0,
        remainingTime: 0,
      });

      // 发送成功事件
      this.emitSuccess(response);

      // 清理资源
      this.cleanup();
    } catch (error) {
      console.error("合并分片失败:", error);
      this.handleError(error as UploadError);
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitor(): void {
    if (this.speedUpdateInterval) {
      clearInterval(this.speedUpdateInterval);
    }

    this.previousLoaded = this.loadedBytes;

    // 每秒更新一次速度
    this.speedUpdateInterval = setInterval(() => {
      this.updateProgress();
    }, 1000);
  }

  /**
   * 停止性能监控
   */
  private stopPerformanceMonitor(): void {
    if (this.speedUpdateInterval) {
      clearInterval(this.speedUpdateInterval);
      this.speedUpdateInterval = null;
    }
  }

  /**
   * 计算上传速度 (bytes/s)
   */
  private calculateSpeed(): number {
    const now = Date.now();
    const timeElapsed = (now - this.uploadStartTime) / 1000; // 转换为秒

    if (timeElapsed <= 0) return 0;

    // 当前速度
    const currentSpeed = Math.max(0, this.loadedBytes - this.previousLoaded);
    this.previousLoaded = this.loadedBytes;

    // 返回每秒速度
    return currentSpeed;
  }

  /**
   * 计算预估剩余时间（毫秒）
   */
  private calculateRemainingTime(): number {
    const speed = this.calculateSpeed();

    if (speed <= 0) return 0;

    const remainingBytes = this.options.file.size - this.loadedBytes;
    // 剩余字节 / 每秒速度 = 剩余秒数，转换为毫秒
    return (remainingBytes / speed) * 1000;
  }

  /**
   * 发送进度事件
   */
  private emitProgress(progress: UploadProgress): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(progress);
      } catch (error) {
        console.error("Progress listener error:", error);
      }
    });
  }

  /**
   * 发送错误事件
   */
  private emitError(error: UploadError): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error("Error listener error:", err);
      }
    });
  }

  /**
   * 发送成功事件
   */
  private emitSuccess(response: UploadResponse): void {
    this.successListeners.forEach((listener) => {
      try {
        listener(response);
      } catch (error) {
        console.error("Success listener error:", error);
      }
    });
  }

  /**
   * 处理错误
   */
  private handleError(error: UploadError): void {
    // 如果不是自定义上传错误，包装一下
    if (!error.type) {
      error = {
        type: UploadErrorType.SERVER_ERROR,
        message: error.message || "未知错误",
        retryable: false,
      };
    }

    // 发送错误事件
    this.emitError(error);

    // 更新上传状态
    if (this.fileInfo) {
      this.emitProgress({
        fileId: this.fileInfo.fileId,
        fileName: this.fileInfo.fileName,
        loaded: this.loadedBytes,
        total: this.options.file.size,
        percent: Math.floor((this.loadedBytes / this.options.file.size) * 100),
        status: "error",
        speed: 0,
        remainingTime: 0,
      });
    }

    // 清理资源
    this.cleanup();
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.isRunning = false;
    this.isPaused = false;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.stopPerformanceMonitor();
  }
}
