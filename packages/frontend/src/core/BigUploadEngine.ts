/**
 * BigUpload 核心上传引擎
 * 纯逻辑实现，不依赖任何UI框架，方便第三方集成
 */

import { v4 as uuidv4 } from "uuid";
import SparkMD5 from "spark-md5";

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

    this.log("BigUploadEngine initialized", this.config);
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

    if (fileState.status !== "pending") {
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
    if (!fileState || fileState.status !== "paused") {
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
    // 使用 SparkMD5 计算文件哈希，与后端保持一致
    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      const chunkSize = 2 * 1024 * 1024; // 2MB，与后端保持一致
      let currentChunk = 0;
      const chunks = Math.ceil(file.size / chunkSize);

      const loadNext = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        fileReader.readAsArrayBuffer(chunk);
      };

      fileReader.onload = (e) => {
        if (e.target?.result) {
          spark.append(e.target.result as ArrayBuffer);
          currentChunk++;

          if (currentChunk < chunks) {
            loadNext();
          } else {
            resolve(spark.end());
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

    try {
      await this.request("/upload-chunk", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      // 更新进度
      this.updateProgress(fileId, chunkIndex);
    } finally {
      this.abortControllers.delete(fileId);
    }
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
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = task();
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
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

    this.updateFileState(fileId, {
      status: "error",
      error: uploadError,
    });

    this.emitEvent("error", { fileId, error: uploadError });
    this.log("Upload error", { fileId, error: uploadError });
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
