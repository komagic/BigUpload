/**
 * BigUpload 核心上传引擎
 * 基于 Uppy (29.9k ⭐) 的最佳实践优化
 * 支持断点续传、智能重试、硬件感知并发
 */

import { v4 as uuidv4 } from "uuid";

// 核心类型定义
export interface UploadConfig {
  /** 后端API基础URL */
  baseUrl: string;
  /** 分片大小（字节），默认0.8MB (Uppy 最佳实践) */
  chunkSize?: number;
  /** 并发上传数量，默认根据硬件能力自动设置 */
  concurrent?: number;
  /** 重试延迟数组（毫秒），采用 TUS 协议推荐的递增延迟 */
  retryDelays?: number[];
  /** 请求头 */
  headers?: Record<string, string>;
  /** 是否启用调试日志 */
  debug?: boolean;
  /** API路径配置 */
  apiPaths?: {
    verify: string;
    upload: string;
    merge: string;
  };
  /** 是否启用硬件感知并发控制 */
  useHardwareConcurrency?: boolean;
}

export interface FileUploadState {
  /** 文件ID */
  fileId: string;
  /** 文件对象 */
  file: File;
  /** 文件哈希值 */
  fileHash?: string;
  /** 上传状态 */
  status:
    | "pending"
    | "hashing"
    | "verifying"
    | "uploading"
    | "merging"
    | "completed"
    | "error"
    | "paused"
    | "cancelled";
  /** 上传进度 */
  progress: UploadProgress;
  /** 错误信息 */
  error?: UploadError;
  /** 上传结果 */
  result?: UploadResult;
  /** 分片重试计数 */
  chunkRetries?: Map<number, number>;
}

export interface UploadProgress {
  /** 已上传字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 上传百分比 */
  percent: number;
  /** 上传速度（字节/秒） */
  speed: number;
  /** 剩余时间（秒） */
  remainingTime: number;
  /** 已上传分片数 */
  uploadedChunks: number;
  /** 总分片数 */
  totalChunks: number;
  /** 当前上传的分片索引 */
  currentChunk?: number;
}

export interface UploadError {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
  retryAfter?: number; // 建议重试延迟时间
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  url?: string;
  message: string;
  uploadTime?: number; // 总上传时间
  averageSpeed?: number; // 平均上传速度
}

// 事件类型
export type UploadEventType =
  | "progress"
  | "success"
  | "error"
  | "stateChange"
  | "chunkCompleted";

export type UploadEventHandler<T = any> = (data: T) => void;

/**
 * 大文件上传核心引擎 - 基于 Uppy 最佳实践
 */
export class BigUploadEngine {
  private config: Required<UploadConfig>;
  private files: Map<string, FileUploadState> = new Map();
  private eventHandlers: Map<string, Set<UploadEventHandler>> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private uploadStartTimes: Map<string, number> = new Map();

  constructor(config: UploadConfig) {
    this.config = {
      chunkSize: 0.8 * 1024 * 1024, // 0.8MB - Uppy 推荐的分片大小
      concurrent: this.getOptimalConcurrency(
        config.useHardwareConcurrency !== false
      ),
      retryDelays: [0, 3000, 5000, 10000, 20000], // TUS 协议推荐的重试延迟
      headers: {},
      debug: false,
      apiPaths: {
        verify: "/verify",
        upload: "/upload-chunk",
        merge: "/merge-chunks",
      },
      useHardwareConcurrency: true,
      ...config,
    };

    this.log("BigUploadEngine initialized with Uppy best practices", {
      chunkSize: `${(this.config.chunkSize / 1024 / 1024).toFixed(1)}MB`,
      concurrent: this.config.concurrent,
      retryDelays: this.config.retryDelays,
      hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
    });
  }

  /**
   * 获取最优并发数 - 基于硬件能力和 Uppy 最佳实践
   */
  private getOptimalConcurrency(useHardwareConcurrency: boolean): number {
    if (!useHardwareConcurrency) {
      return 3; // 默认值
    }

    const hwConcurrency = navigator.hardwareConcurrency || 4;

    // Uppy 的并发策略：
    // - 单核/双核：1个并发
    // - 四核：2个并发
    // - 八核及以上：3-4个并发
    if (hwConcurrency <= 2) {
      return 1;
    } else if (hwConcurrency <= 4) {
      return 2;
    } else if (hwConcurrency <= 8) {
      return 3;
    } else {
      return Math.min(4, Math.floor(hwConcurrency / 2)); // 最多4个并发
    }
  }

  /**
   * 添加文件到上传队列
   */
  async addFile(file: File): Promise<string> {
    const fileId = uuidv4();
    const totalChunks = Math.ceil(file.size / this.config.chunkSize);

    const fileState: FileUploadState = {
      fileId,
      file,
      status: "pending",
      progress: {
        loaded: 0,
        total: file.size,
        percent: 0,
        speed: 0,
        remainingTime: 0,
        uploadedChunks: 0,
        totalChunks,
      },
      chunkRetries: new Map(),
    };

    this.files.set(fileId, fileState);
    this.emitEvent("stateChange", { fileId, state: fileState });

    this.log("File added to queue", {
      fileId,
      fileName: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      totalChunks,
    });
    return fileId;
  }

  /**
   * 开始上传文件 - 采用 Uppy 的断点续传策略
   */
  async startUpload(fileId: string): Promise<void> {
    const fileState = this.files.get(fileId);
    if (!fileState) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (
      fileState.status !== "pending" &&
      fileState.status !== "error" &&
      fileState.status !== "paused"
    ) {
      this.log("File upload already started or completed", {
        fileId,
        status: fileState.status,
      });
      return;
    }

    try {
      this.uploadStartTimes.set(fileId, Date.now());
      this.updateFileState(fileId, { status: "hashing" });

      // 1. 计算文件哈希 (Web Crypto API)
      if (!fileState.fileHash) {
        fileState.fileHash = await this.calculateFileHash(fileState.file);
        this.log("File hash calculated", { fileId, hash: fileState.fileHash });
      }

      this.updateFileState(fileId, { status: "verifying" });

      // 2. 验证文件并获取已上传分片 (断点续传核心)
      const verifyResult = await this.verifyFile(fileId);

      if (verifyResult.exists && verifyResult.finish) {
        // 秒传成功
        this.completeUpload(fileId, {
          success: true,
          fileId,
          url: verifyResult.url,
          message: "文件已存在，秒传成功",
        });
        return;
      }

      // 3. 分片上传 - 跳过已上传的分片
      this.updateFileState(fileId, { status: "uploading" });
      await this.uploadChunks(fileId, verifyResult.uploadedChunks || []);

      // 4. 合并分片
      this.updateFileState(fileId, { status: "merging" });
      const mergeResult = await this.mergeChunks(fileId);

      // 5. 完成上传
      this.completeUpload(fileId, {
        success: true,
        fileId,
        url: mergeResult.url,
        message: "文件上传成功",
      });
    } catch (error) {
      this.handleError(fileId, error);
    }
  }

  /**
   * 完成上传 - 计算性能指标
   */
  private completeUpload(
    fileId: string,
    result: Omit<UploadResult, "uploadTime" | "averageSpeed">
  ): void {
    const startTime = this.uploadStartTimes.get(fileId);
    const fileState = this.files.get(fileId);

    if (startTime && fileState) {
      const uploadTime = Date.now() - startTime;
      const averageSpeed = fileState.file.size / (uploadTime / 1000); // bytes/second

      const finalResult: UploadResult = {
        ...result,
        uploadTime,
        averageSpeed,
      };

      this.updateFileState(fileId, {
        status: "completed",
        result: finalResult,
      });

      this.log("Upload completed", {
        fileId,
        uploadTime: `${(uploadTime / 1000).toFixed(2)}s`,
        averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)}MB/s`,
      });

      this.emitEvent("success", { fileId, result: finalResult });
    }

    this.uploadStartTimes.delete(fileId);
  }

  /**
   * 暂停上传
   */
  pauseUpload(fileId: string): void {
    const fileState = this.files.get(fileId);
    if (!fileState || fileState.status !== "uploading") {
      return;
    }

    const abortController = this.abortControllers.get(fileId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(fileId);
    }

    this.updateFileState(fileId, { status: "paused" });
    this.log("Upload paused", { fileId });
  }

  /**
   * 继续上传 - 断点续传
   */
  async resumeUpload(fileId: string): Promise<void> {
    const fileState = this.files.get(fileId);
    if (
      !fileState ||
      (fileState.status !== "paused" && fileState.status !== "error")
    ) {
      return;
    }

    this.log("Resuming upload with checkpoint recovery", { fileId });
    await this.startUpload(fileId);
  }

  /**
   * 取消上传
   */
  cancelUpload(fileId: string): void {
    const abortController = this.abortControllers.get(fileId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(fileId);
    }

    this.updateFileState(fileId, { status: "cancelled" });
    this.uploadStartTimes.delete(fileId);
    this.log("Upload cancelled", { fileId });
  }

  /**
   * 移除文件
   */
  removeFile(fileId: string): void {
    this.cancelUpload(fileId);
    this.files.delete(fileId);
    this.log("File removed", { fileId });
  }

  /**
   * 获取文件状态
   */
  getFileState(fileId: string): FileUploadState | undefined {
    return this.files.get(fileId);
  }

  /**
   * 获取所有文件状态
   */
  getAllFiles(): FileUploadState[] {
    return Array.from(this.files.values());
  }

  /**
   * 事件监听
   */
  on<T = any>(
    event: UploadEventType,
    handler: UploadEventHandler<T>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // 返回取消监听的函数
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * 移除事件监听
   */
  off(event: UploadEventType, handler?: UploadEventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.get(event)?.delete(handler);
    }
  }

  // ========== 私有方法 ==========

  private async calculateFileHash(file: File): Promise<string> {
    // 使用 Web Crypto API 计算 SHA-256
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const buffer = e.target.result as ArrayBuffer;
            const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            resolve(hash);
          } catch (error) {
            reject(error);
          }
        }
      };

      fileReader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      fileReader.readAsArrayBuffer(file);
    });
  }

  private async verifyFile(fileId: string): Promise<any> {
    const fileState = this.files.get(fileId)!;

    const response = await this.request(this.config.apiPaths.verify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId,
        fileName: fileState.file.name,
        filename: fileState.file.name, // Python后端兼容
        fileHash: fileState.fileHash,
        fileSize: fileState.file.size,
        chunkTotal: fileState.progress.totalChunks,
      }),
    });

    return response;
  }

  private async uploadChunks(
    fileId: string,
    uploadedChunks: number[]
  ): Promise<void> {
    const fileState = this.files.get(fileId)!;
    const { progress } = fileState;

    // 创建待上传分片队列 - 跳过已上传的分片
    const tasks: Array<() => Promise<void>> = [];
    const uploadedChunksSet = new Set(uploadedChunks);

    this.log(`Planning chunk upload strategy`, {
      totalChunks: progress.totalChunks,
      alreadyUploaded: uploadedChunks.length,
      needUpload: progress.totalChunks - uploadedChunks.length,
      concurrent: this.config.concurrent,
    });

    for (let i = 0; i < progress.totalChunks; i++) {
      if (uploadedChunksSet.has(i)) {
        this.log(`✓ Chunk ${i} already uploaded, skipping`);
        continue;
      }
      tasks.push(() => this.uploadChunk(fileId, i));
    }

    if (tasks.length === 0) {
      this.log("All chunks already uploaded, proceeding to merge");
      return;
    }

    this.log(`Starting concurrent upload: ${tasks.length} chunks`);

    // 并发上传分片 - 采用 Uppy 的并发策略
    await this.executeConcurrentTasks(tasks, this.config.concurrent);
  }

  private async uploadChunk(fileId: string, chunkIndex: number): Promise<void> {
    const fileState = this.files.get(fileId)!;
    const { file, fileHash, chunkRetries } = fileState;

    const start = chunkIndex * this.config.chunkSize;
    const end = Math.min(start + this.config.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("fileId", fileId);
    formData.append("fileName", file.name);
    formData.append("filename", file.name); // Python后端兼容
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("chunkTotal", fileState.progress.totalChunks.toString());
    formData.append("fileHash", fileHash!);

    const abortController = new AbortController();
    this.abortControllers.set(`${fileId}_${chunkIndex}`, abortController);

    // TUS 风格的重试机制
    const retryCount = chunkRetries?.get(chunkIndex) || 0;
    let lastError: any;

    for (let attempt = 0; attempt < this.config.retryDelays.length; attempt++) {
      if (abortController.signal.aborted) {
        throw new Error("Upload aborted");
      }

      try {
        this.log(
          `📤 Uploading chunk ${chunkIndex}, attempt ${attempt + 1}/${
            this.config.retryDelays.length
          }`
        );

        // 更新当前上传的分片
        this.updateFileState(fileId, {
          progress: { ...fileState.progress, currentChunk: chunkIndex },
        });

        await this.request(this.config.apiPaths.upload, {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });

        // 上传成功
        this.updateProgress(fileId, chunkIndex);
        this.emitEvent("chunkCompleted", {
          fileId,
          chunkIndex,
          totalChunks: fileState.progress.totalChunks,
        });
        this.abortControllers.delete(`${fileId}_${chunkIndex}`);

        this.log(`✅ Chunk ${chunkIndex} uploaded successfully`);
        return;
      } catch (error: any) {
        lastError = error;

        if (abortController.signal.aborted) {
          throw error;
        }

        const isRetryable = this.isRetryableError(error);
        this.log(
          `❌ Chunk ${chunkIndex} failed (attempt ${attempt + 1}): ${
            error.message
          }`,
          {
            retryable: isRetryable,
            willRetry:
              attempt < this.config.retryDelays.length - 1 && isRetryable,
          }
        );

        // 更新重试计数
        if (chunkRetries) {
          chunkRetries.set(chunkIndex, retryCount + 1);
        }

        // 最后一次尝试或不可重试的错误
        if (attempt === this.config.retryDelays.length - 1 || !isRetryable) {
          break;
        }

        // TUS 风格的递增延迟重试
        const delay = this.config.retryDelays[attempt];
        if (delay > 0) {
          this.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.abortControllers.delete(`${fileId}_${chunkIndex}`);
    throw lastError;
  }

  /**
   * 判断错误是否可重试 - 基于 Uppy 的错误分类策略
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error.message || "";

    // 网络相关错误 - 可重试
    if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("Failed to fetch")
    ) {
      return true;
    }

    // HTTP状态码错误分类
    if (errorMessage.includes("HTTP")) {
      // 5xx 服务器错误 - 可重试
      if (
        errorMessage.includes("500") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("507") ||
        errorMessage.includes("508")
      ) {
        return true;
      }

      // 429 限流错误 - 可重试
      if (errorMessage.includes("429")) {
        return true;
      }

      // 408 请求超时 - 可重试
      if (errorMessage.includes("408")) {
        return true;
      }

      // 4xx 客户端错误 - 通常不可重试
      if (
        errorMessage.includes("400") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403") ||
        errorMessage.includes("404") ||
        errorMessage.includes("422")
      ) {
        return false;
      }
    }

    // 默认认为可重试 (宽松策略)
    return true;
  }

  private async mergeChunks(fileId: string): Promise<any> {
    const fileState = this.files.get(fileId)!;

    const response = await this.request(this.config.apiPaths.merge, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId,
        fileName: fileState.file.name,
        filename: fileState.file.name, // Python后端兼容
        fileHash: fileState.fileHash,
        chunkTotal: fileState.progress.totalChunks,
        fileSize: fileState.file.size,
      }),
    });

    return response;
  }

  private async request(path: string, options: RequestInit): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;

    this.log(`🌐 Request: ${options.method} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
      });

      this.log(`📡 Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`❌ Response error:`, errorText);
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      this.log(`✅ Response data:`, result);

      if (result.success === false) {
        throw new Error(result.message || "Server error");
      }

      return result;
    } catch (error) {
      this.log(`💥 Request failed:`, error);
      throw error;
    }
  }

  /**
   * 并发任务执行器 - 采用 Uppy 的宽松错误策略
   */
  private async executeConcurrentTasks(
    tasks: Array<() => Promise<void>>,
    concurrency: number
  ): Promise<void> {
    const executing: Array<{ promise: Promise<void>; index: number }> = [];
    const errors: Array<{ error: any; index: number }> = [];
    const completed: number[] = [];
    let taskIndex = 0;

    this.log(
      `🚀 Starting concurrent upload: ${tasks.length} tasks, ${concurrency} concurrent`
    );

    while (taskIndex < tasks.length || executing.length > 0) {
      // 启动新任务直到达到并发限制
      while (executing.length < concurrency && taskIndex < tasks.length) {
        const currentIndex = taskIndex;
        const task = tasks[taskIndex];

        const promise = task()
          .then(() => {
            completed.push(currentIndex);
            this.log(`✅ Task ${currentIndex} completed successfully`);
          })
          .catch((error) => {
            errors.push({ error, index: currentIndex });
            this.log(`❌ Task ${currentIndex} failed:`, error);
            throw error;
          });

        executing.push({ promise, index: currentIndex });
        taskIndex++;
      }

      if (executing.length === 0) break;

      // 等待至少一个任务完成
      try {
        await Promise.race(executing.map((item) => item.promise));
      } catch (error) {
        // 单个任务失败不影响其他任务继续执行
      }

      // 移除已完成的任务
      const settled = await Promise.allSettled(
        executing.map((item) => item.promise)
      );
      for (let i = executing.length - 1; i >= 0; i--) {
        if (
          settled[i].status === "fulfilled" ||
          settled[i].status === "rejected"
        ) {
          executing.splice(i, 1);
        }
      }
    }

    this.log(
      `📊 Upload completed: ${completed.length} success, ${errors.length} failed`
    );

    // Uppy 风格的宽松错误处理策略
    if (errors.length > 0) {
      const errorRate = errors.length / tasks.length;
      this.log(`📈 Error rate: ${(errorRate * 100).toFixed(1)}%`);

      // 只有当失败率过高时才抛出错误 (比之前更宽松的策略)
      if (errorRate > 0.7) {
        // 70%以上失败才认为是严重错误
        throw new Error(
          `Upload failed: ${errors.length}/${tasks.length} chunks failed. ${errors[0].error.message}`
        );
      } else if (errorRate > 0.3) {
        // 30%-70%失败率给出警告
        this.log(
          `⚠️  High error rate (${(errorRate * 100).toFixed(
            1
          )}%), but continuing with available chunks`
        );
      }

      // 即使有部分分片失败，也尝试合并 (断点续传机制)
      this.log(
        `🔄 Proceeding to merge despite ${errors.length}/${tasks.length} failed chunks (will be retried on resume)`
      );
    }
  }

  private updateFileState(
    fileId: string,
    updates: Partial<FileUploadState>
  ): void {
    const fileState = this.files.get(fileId);
    if (!fileState) return;

    Object.assign(fileState, updates);
    this.files.set(fileId, fileState);

    this.emitEvent("stateChange", { fileId, state: fileState });
  }

  /**
   * 更新上传进度 - 计算速度和剩余时间
   */
  private updateProgress(fileId: string, completedChunk: number): void {
    const fileState = this.files.get(fileId);
    if (!fileState) return;

    const previousUploaded = fileState.progress.uploadedChunks;
    fileState.progress.uploadedChunks++;
    
    // 更精确的进度计算
    const chunkSize = Math.min(
      this.config.chunkSize,
      fileState.file.size - completedChunk * this.config.chunkSize
    );
    fileState.progress.loaded += chunkSize;
    fileState.progress.percent = Math.min(
      Math.round((fileState.progress.loaded / fileState.progress.total) * 100),
      100
    );

    // 计算上传速度 (基于最近完成的分片)
    const startTime = this.uploadStartTimes.get(fileId);
    if (startTime) {
      const elapsed = Date.now() - startTime;
      if (elapsed > 0) {
        fileState.progress.speed = (fileState.progress.loaded / elapsed) * 1000; // bytes/second
        
        // 估算剩余时间
        if (fileState.progress.speed > 0) {
          const remaining = fileState.progress.total - fileState.progress.loaded;
          fileState.progress.remainingTime = Math.round(remaining / fileState.progress.speed);
        }
      }
    }

    this.log(`📈 Progress: ${fileState.progress.percent}% (${fileState.progress.uploadedChunks}/${fileState.progress.totalChunks} chunks)`);

    this.emitEvent("progress", { fileId, progress: fileState.progress });
    this.emitEvent("stateChange", { fileId, state: fileState });
  }

  /**
   * 错误处理 - 支持自动恢复和智能重试建议
   */
  private handleError(fileId: string, error: any): void {
    const uploadError: UploadError = {
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "Unknown error occurred",
      retryable: true,
      details: error,
    };

    // 分析错误类型并设置重试建议
    if (error.message) {
      if (error.message.includes("网络")) {
        uploadError.retryAfter = 3000; // 网络错误建议3秒后重试
      } else if (error.message.includes("服务器")) {
        uploadError.retryAfter = 5000; // 服务器错误建议5秒后重试
      } else if (error.message.includes("429")) {
        uploadError.retryAfter = 10000; // 限流错误建议10秒后重试
      }
    }

    // 文件元数据不存在的自动恢复
    if (error.message && error.message.includes("文件元数据不存在")) {
      this.log("🔄 File metadata missing, attempting auto-recovery", { fileId });
      this.attemptAutoRecovery(fileId, uploadError);
      return;
    }

    // 标记是否可重试
    uploadError.retryable = this.isRetryableError(error);

    this.updateFileState(fileId, {
      status: "error",
      error: uploadError,
    });

    this.emitEvent("error", { fileId, error: uploadError });
    this.log("💥 Upload error", { fileId, error: uploadError });
  }

  /**
   * 自动恢复机制 - 基于 Uppy 的弹性策略
   */
  private async attemptAutoRecovery(
    fileId: string,
    error: UploadError
  ): Promise<void> {
    try {
      this.log("🔧 Starting auto-recovery process", { fileId });

      // 重置文件状态到等待状态
      this.updateFileState(fileId, {
        status: "pending",
        error: undefined,
        progress: {
          ...this.files.get(fileId)!.progress,
          loaded: 0,
          percent: 0,
          uploadedChunks: 0,
        },
      });

      // 使用 TUS 风格的延迟重试
      const retryDelay = error.retryAfter || 3000;
      this.log(`⏳ Auto-recovery scheduled in ${retryDelay}ms`);

      setTimeout(async () => {
        try {
          await this.startUpload(fileId);
          this.log("✅ Auto-recovery successful", { fileId });
        } catch (retryError: any) {
          this.log("❌ Auto-recovery failed", { fileId, retryError });
          this.updateFileState(fileId, {
            status: "error",
            error: {
              ...error,
              message: `自动恢复失败: ${retryError.message || retryError}`,
              retryable: true,
            },
          });
          this.emitEvent("error", { fileId, error });
        }
      }, retryDelay);
    } catch (recoveryError: any) {
      this.log("💥 Auto-recovery setup failed", { fileId, recoveryError });
      this.updateFileState(fileId, {
        status: "error",
        error: {
          ...error,
          message: `恢复设置失败: ${recoveryError.message || recoveryError}`,
        },
      });
      this.emitEvent("error", { fileId, error });
    }
  }

  private emitEvent<T = any>(event: UploadEventType, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error("Event handler error:", error);
        }
      });
    }
  }

  /**
   * 调试日志 - 带表情符号的可视化日志
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[BigUploadEngine] ${message}`, data);
    }
  }
}

/**
 * 创建上传引擎实例 - 便捷工厂函数
 */
export function createUploadEngine(baseUrl: string, config?: Partial<UploadConfig>): BigUploadEngine {
  return new BigUploadEngine({
    baseUrl,
    ...config,
  });
}
