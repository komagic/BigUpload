/**
 * BigUpload 核心上传引擎
 * 纯逻辑实现，不依赖任何UI框架，方便第三方集成
 */

import { v4 as uuidv4 } from "uuid";
// 移除 SparkMD5 依赖，使用 Web Crypto API

// 核心类型定义
export interface UploadConfig {
  /** 后端API基础URL */
  baseUrl: string;
  /** 分片大小（字节），默认2MB */
  chunkSize?: number;
  /** 并发上传数量，默认3 */
  concurrent?: number;
  /** 重试次数，默认3 */
  retryCount?: number;
  /** 重试延迟（毫秒），默认1000 */
  retryDelay?: number;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 是否启用调试日志 */
  debug?: boolean;
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
}

export interface UploadError {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  url?: string;
  message: string;
}

// 事件类型
export type UploadEventType = "progress" | "success" | "error" | "stateChange";

export type UploadEventHandler<T = any> = (data: T) => void;

/**
 * 大文件上传核心引擎
 */
export class BigUploadEngine {
  private config: Required<UploadConfig>;
  private files: Map<string, FileUploadState> = new Map();
  private eventHandlers: Map<string, Set<UploadEventHandler>> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: UploadConfig) {
    this.config = {
      chunkSize: 2 * 1024 * 1024, // 2MB
      concurrent: 3,
      retryCount: 3,
      retryDelay: 1000,
      headers: {},
      debug: false,
      ...config,
    };

    // 根据文件大小动态调整并发数
    this.adjustConcurrencyForLargeFiles();

    this.log("BigUploadEngine initialized", this.config);
  }

  private adjustConcurrencyForLargeFiles(): void {
    // 移除自动降低并发数的逻辑，保持用户配置的并发数
    // 改为在运行时根据错误情况动态调整
    this.log("Concurrency settings", {
      concurrent: this.config.concurrent,
      chunkSize: this.config.chunkSize,
    });
  }

  /**
   * 添加文件到上传队列
   */
  async addFile(file: File): Promise<string> {
    const fileId = uuidv4();
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
        totalChunks: Math.ceil(file.size / this.config.chunkSize),
      },
    };

    this.files.set(fileId, fileState);
    this.emitEvent("stateChange", { fileId, state: fileState });

    this.log("File added to queue", {
      fileId,
      fileName: file.name,
      size: file.size,
    });
    return fileId;
  }

  /**
   * 开始上传文件
   */
  async startUpload(fileId: string): Promise<void> {
    const fileState = this.files.get(fileId);
    if (!fileState) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (fileState.status !== "pending" && fileState.status !== "error") {
      this.log("File upload already started or completed", {
        fileId,
        status: fileState.status,
      });
      return;
    }

    try {
      this.updateFileState(fileId, { status: "hashing" });

      // 1. 计算文件哈希
      fileState.fileHash = await this.calculateFileHash(fileState.file);
      this.log("File hash calculated", { fileId, hash: fileState.fileHash });

      this.updateFileState(fileId, { status: "verifying" });

      // 2. 验证文件是否已存在
      const verifyResult = await this.verifyFile(fileId);

      if (verifyResult.exists && verifyResult.finish) {
        // 秒传
        this.updateFileState(fileId, {
          status: "completed",
          result: {
            success: true,
            fileId,
            url: verifyResult.url,
            message: "文件已存在，秒传成功",
          },
        });
        this.emitEvent("success", { fileId, result: fileState.result });
        return;
      }

      // 3. 开始分片上传
      this.updateFileState(fileId, { status: "uploading" });
      await this.uploadChunks(fileId, verifyResult.uploadedChunks || []);

      // 4. 合并分片
      this.updateFileState(fileId, { status: "merging" });
      const mergeResult = await this.mergeChunks(fileId);

      // 5. 完成上传
      this.updateFileState(fileId, {
        status: "completed",
        result: {
          success: true,
          fileId,
          url: mergeResult.url,
          message: "文件上传成功",
        },
      });

      this.emitEvent("success", { fileId, result: fileState.result });
    } catch (error) {
      this.handleError(fileId, error);
    }
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
   * 继续上传
   */
  async resumeUpload(fileId: string): Promise<void> {
    const fileState = this.files.get(fileId);
    if (
      !fileState ||
      (fileState.status !== "paused" && fileState.status !== "error")
    ) {
      return;
    }

    this.log("Resuming upload", { fileId });

    // 重新验证并继续上传
    try {
      this.updateFileState(fileId, { status: "verifying" });
      const verifyResult = await this.verifyFile(fileId);

      this.updateFileState(fileId, { status: "uploading" });
      await this.uploadChunks(fileId, verifyResult.uploadedChunks || []);

      this.updateFileState(fileId, { status: "merging" });
      const mergeResult = await this.mergeChunks(fileId);

      this.updateFileState(fileId, {
        status: "completed",
        result: {
          success: true,
          fileId,
          url: mergeResult.url,
          message: "文件上传成功",
        },
      });

      this.emitEvent("success", { fileId, result: fileState.result });
    } catch (error) {
      this.handleError(fileId, error);
    }
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
    // 使用 Web Crypto API 计算文件哈希（SHA-256），与后端保持一致
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      const chunkSize = 2 * 1024 * 1024; // 2MB，与后端保持一致
      let currentChunk = 0;
      const chunks = Math.ceil(file.size / chunkSize);
      const chunkHashes: string[] = []; // 存储每个分片的哈希值

      const loadNext = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        fileReader.readAsArrayBuffer(chunk);
      };

      fileReader.onload = async (e) => {
        if (e.target?.result) {
          try {
            // 计算当前分片的哈希值
            const buffer = e.target.result as ArrayBuffer;
            const chunkHashBuffer = await crypto.subtle.digest(
              "SHA-256",
              buffer
            );
            const chunkHashArray = Array.from(new Uint8Array(chunkHashBuffer));
            const chunkHash = chunkHashArray
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            chunkHashes.push(chunkHash);
            currentChunk++;

            if (currentChunk < chunks) {
              loadNext();
            } else {
              // 计算最终哈希值
              const combinedHashes = chunkHashes.join("");
              const encoder = new TextEncoder();
              const data = encoder.encode(combinedHashes);
              const finalHashBuffer = await crypto.subtle.digest(
                "SHA-256",
                data
              );
              const finalHashArray = Array.from(
                new Uint8Array(finalHashBuffer)
              );
              const finalHash = finalHashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

              resolve(finalHash);
            }
          } catch (error) {
            reject(error);
          }
        }
      };

      fileReader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      loadNext();
    });
  }

  private async verifyFile(fileId: string): Promise<any> {
    const fileState = this.files.get(fileId)!;

    const response = await this.request("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId,
        fileName: fileState.file.name,
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
    const { file, progress } = fileState;

    // 创建上传任务队列
    const tasks: Array<() => Promise<void>> = [];

    for (let i = 0; i < progress.totalChunks; i++) {
      if (uploadedChunks.includes(i)) {
        continue; // 跳过已上传的分片
      }

      tasks.push(() => this.uploadChunk(fileId, i));
    }

    // 并发上传
    await this.executeConcurrentTasks(tasks, this.config.concurrent);
  }

  private async uploadChunk(fileId: string, chunkIndex: number): Promise<void> {
    const fileState = this.files.get(fileId)!;
    const { file, fileHash } = fileState;

    const start = chunkIndex * this.config.chunkSize;
    const end = Math.min(start + this.config.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("fileId", fileId);
    formData.append("fileName", file.name);
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("chunkTotal", fileState.progress.totalChunks.toString());
    formData.append("fileHash", fileHash!);

    const abortController = new AbortController();
    this.abortControllers.set(fileId, abortController);

    let lastError: any;

    // 实现重试机制
    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        this.log(
          `Uploading chunk ${chunkIndex}, attempt ${attempt + 1}/${
            this.config.retryCount + 1
          }`
        );

        await this.request("/upload-chunk", {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });

        // 上传成功，更新进度
        this.updateProgress(fileId, chunkIndex);
        this.abortControllers.delete(fileId);
        return;
      } catch (error) {
        lastError = error;
        this.log(
          `Chunk ${chunkIndex} upload failed, attempt ${attempt + 1}`,
          error
        );

        // 如果是最后一次尝试，或者是不可重试的错误，直接抛出
        if (
          attempt === this.config.retryCount ||
          abortController.signal.aborted
        ) {
          break;
        }

        // 等待重试延迟
        if (this.config.retryDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay)
          );
        }
      }
    }

    this.abortControllers.delete(fileId);
    throw lastError;
  }

  private async mergeChunks(fileId: string): Promise<any> {
    const fileState = this.files.get(fileId)!;

    const response = await this.request("/merge-chunks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId,
        fileName: fileState.file.name,
        fileHash: fileState.fileHash,
        chunkTotal: fileState.progress.totalChunks,
        fileSize: fileState.file.size,
      }),
    });

    return response;
  }

  private async request(path: string, options: RequestInit): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;

    this.log(`Making request to: ${url}`, {
      method: options.method,
      headers: options.headers,
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
      });

      this.log(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`Response error:`, errorText);
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      this.log(`Response data:`, result);

      if (result.success === false) {
        throw new Error(result.message || "Server error");
      }

      return result;
    } catch (error) {
      this.log(`Request failed:`, error);
      throw error;
    }
  }

  private async executeConcurrentTasks(
    tasks: Array<() => Promise<void>>,
    concurrency: number
  ): Promise<void> {
    const executing: Array<{ promise: Promise<void>; index: number }> = [];
    const errors: Array<{ error: any; index: number }> = [];
    const completed: number[] = [];
    let taskIndex = 0;

    this.log(
      `Starting concurrent execution: ${tasks.length} tasks, concurrency: ${concurrency}`
    );

    while (taskIndex < tasks.length || executing.length > 0) {
      // 启动新任务直到达到并发限制
      while (executing.length < concurrency && taskIndex < tasks.length) {
        const currentIndex = taskIndex;
        const task = tasks[taskIndex];

        const promise = task()
          .then(() => {
            completed.push(currentIndex);
            this.log(`Task ${currentIndex} completed successfully`);
          })
          .catch((error) => {
            errors.push({ error, index: currentIndex });
            this.log(`Task ${currentIndex} failed:`, error);
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
      `Concurrent execution completed. Success: ${completed.length}, Errors: ${errors.length}`
    );

    // 如果有错误，抛出第一个错误
    if (errors.length > 0) {
      const errorRate = errors.length / tasks.length;
      this.log(`Upload error rate: ${(errorRate * 100).toFixed(1)}%`);

      // 如果错误率太高，可能是网络问题，抛出错误
      if (errorRate > 0.1) {
        // 超过10%的分片失败
        throw new Error(
          `Too many chunks failed (${errors.length}/${tasks.length}). ${errors[0].error.message}`
        );
      } else {
        throw errors[0].error;
      }
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

  private updateProgress(fileId: string, completedChunk: number): void {
    const fileState = this.files.get(fileId);
    if (!fileState) return;

    fileState.progress.uploadedChunks++;
    fileState.progress.loaded =
      fileState.progress.uploadedChunks * this.config.chunkSize;
    fileState.progress.percent = Math.round(
      (fileState.progress.loaded / fileState.progress.total) * 100
    );

    // 计算速度和剩余时间的逻辑可以在这里实现

    this.emitEvent("progress", { fileId, progress: fileState.progress });
    this.emitEvent("stateChange", { fileId, state: fileState });
  }

  private handleError(fileId: string, error: any): void {
    const uploadError: UploadError = {
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "Unknown error occurred",
      retryable: true,
      details: error,
    };

    // 如果是文件元数据不存在的错误，尝试自动恢复
    if (error.message && error.message.includes("文件元数据不存在")) {
      this.log("File metadata not found, attempting auto-recovery", { fileId });
      this.attemptAutoRecovery(fileId, uploadError);
      return;
    }

    // 如果是网络错误或服务器错误，标记为可重试
    if (
      error.message &&
      (error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("timeout") ||
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503"))
    ) {
      uploadError.retryable = true;
      this.log("Network/Server error detected, marking as retryable", {
        fileId,
        error,
      });
    }

    this.updateFileState(fileId, {
      status: "error",
      error: uploadError,
    });

    this.emitEvent("error", { fileId, error: uploadError });
    this.log("Upload error", { fileId, error: uploadError });
  }

  private async attemptAutoRecovery(
    fileId: string,
    error: UploadError
  ): Promise<void> {
    try {
      this.log("Starting auto-recovery process", { fileId });

      // 重置文件状态
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

      // 延迟一段时间后自动重新开始上传
      setTimeout(async () => {
        try {
          await this.startUpload(fileId);
        } catch (retryError: any) {
          this.log("Auto-recovery failed", { fileId, retryError });
          this.updateFileState(fileId, {
            status: "error",
            error: {
              ...error,
              message: `自动恢复失败: ${retryError.message || retryError}`,
            },
          });
          this.emitEvent("error", { fileId, error });
        }
      }, 3000); // 3秒后重试
    } catch (recoveryError: any) {
      this.log("Auto-recovery setup failed", { fileId, recoveryError });
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

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[BigUploadEngine] ${message}`, data);
    }
  }
}
