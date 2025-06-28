import {
  UploadOptions,
  UploadProgress,
  UploadResponse,
  UploadError,
} from "bigupload-shared";

// 直接在本地定义错误类型，避免导入问题
enum UploadErrorType {
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  ABORT_ERROR = "ABORT_ERROR",
  HASH_CALCULATION_ERROR = "HASH_CALCULATION_ERROR",
}

import { UploaderService } from "../components/FastUploader/UploaderService";
import { v4 as uuidv4 } from "uuid";

// 单个文件上传状态
export interface FileUploadState {
  id: string; // 内部唯一id
  file: File;
  progress: UploadProgress;
  uploader?: UploaderService;
  error?: UploadError;
}

export class UploadManager {
  private files: FileUploadState[] = [];
  private url: string;
  private options: {
    maxFileSize: number;
    chunkSize: number;
    concurrent: number;
    headers?: Record<string, string>;
    autoUpload: boolean;
  };
  private onProgressCallback?: (progress: UploadProgress) => void;
  private onErrorCallback?: (error: UploadError) => void;
  private onSuccessCallback?: (response: UploadResponse) => void;

  constructor(
    url: string,
    options: {
      maxFileSize?: number;
      chunkSize?: number;
      concurrent?: number;
      headers?: Record<string, string>;
      autoUpload?: boolean;
    } = {}
  ) {
    this.url = url;
    this.options = {
      maxFileSize: options.maxFileSize || 0, // 0表示不限制
      chunkSize: options.chunkSize || 2 * 1024 * 1024, // 默认2MB
      concurrent: options.concurrent || 3,
      headers: options.headers,
      autoUpload: options.autoUpload !== undefined ? options.autoUpload : true,
    };
  }

  // 格式化文件大小的辅助函数
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // 添加文件
  addFiles(selectedFiles: FileList | File[]): FileUploadState[] {
    if (!selectedFiles?.length) return [];

    const newFiles: FileUploadState[] = [];

    // 检查文件大小限制
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // 文件大小检查
      if (
        this.options.maxFileSize > 0 &&
        file.size > this.options.maxFileSize
      ) {
        const error = {
          type: UploadErrorType.FILE_TOO_LARGE,
          message: `文件大小超过限制 (${this.formatFileSize(
            file.size
          )} > ${this.formatFileSize(this.options.maxFileSize)})`,
          retryable: false,
        };
        this.onErrorCallback?.(error);
        continue;
      }

      // 创建文件状态对象
      const fileState: FileUploadState = {
        id: `upload-${uuidv4()}`,
        file,
        progress: {
          fileId: "",
          fileName: file.name,
          loaded: 0,
          total: file.size,
          percent: 0,
          status: "pending",
          speed: 0,
          remainingTime: 0,
        },
      };

      newFiles.push(fileState);
      this.files.push(fileState);
    }

    // 自动开始上传
    if (this.options.autoUpload && newFiles.length > 0) {
      setTimeout(() => {
        newFiles.forEach((file) => this.startUpload(file));
      }, 0);
    }

    return newFiles;
  }

  // 开始上传
  startUpload(fileState: FileUploadState): void {
    // 创建上传选项
    const options: UploadOptions = {
      url: this.url,
      file: fileState.file,
      chunkSize: this.options.chunkSize,
      headers: this.options.headers,
      concurrent: this.options.concurrent,
      withCredentials: true,
      retryCount: 3,
      retryDelay: 1000,
    };

    // 创建上传服务
    const uploader = new UploaderService(options);

    // 监听进度
    uploader.onProgress((progress) => {
      // 更新文件状态
      const index = this.files.findIndex((f) => f.id === fileState.id);
      if (index !== -1) {
        this.files[index].progress = progress;
        // 更新文件状态后，触发状态更新
        this.files = [...this.files];
      }

      // 转发进度回调
      this.onProgressCallback?.(progress);
    });

    // 监听错误
    uploader.onError((error) => {
      // 更新文件状态
      const index = this.files.findIndex((f) => f.id === fileState.id);
      if (index !== -1) {
        this.files[index].error = error;
        this.files[index].progress.status = "error";
        // 更新文件状态后，触发状态更新
        this.files = [...this.files];
      }

      // 转发错误回调
      this.onErrorCallback?.(error);
    });

    // 监听成功
    uploader.onSuccess((response) => {
      // 更新文件状态
      const index = this.files.findIndex((f) => f.id === fileState.id);
      if (index !== -1) {
        this.files[index].progress.status = "completed";
        this.files[index].progress.loaded = this.files[index].progress.total;
        this.files[index].progress.percent = 100;
        // 更新文件状态后，触发状态更新
        this.files = [...this.files];
      }

      // 转发成功回调
      this.onSuccessCallback?.(response);
    });

    // 保存上传器实例
    fileState.uploader = uploader;

    // 开始上传
    uploader.start().catch((error) => {
      console.error("上传启动失败:", error);
      // 更新文件状态
      const index = this.files.findIndex((f) => f.id === fileState.id);
      if (index !== -1) {
        this.files[index].error = error;
        this.files[index].progress.status = "error";
        // 更新文件状态后，触发状态更新
        this.files = [...this.files];
      }

      // 转发错误回调
      this.onErrorCallback?.(error);
    });
  }

  // 暂停上传
  pauseUpload(fileId: string): void {
    const file = this.files.find((f) => f.id === fileId);
    if (file?.uploader) {
      file.uploader.pause();
    }
  }

  // 恢复上传
  resumeUpload(fileId: string): void {
    const file = this.files.find((f) => f.id === fileId);
    if (file?.uploader) {
      file.uploader.resume();
    }
  }

  // 取消上传
  cancelUpload(fileId: string): void {
    const file = this.files.find((f) => f.id === fileId);
    if (file?.uploader) {
      file.uploader.cancel();
    }
  }

  // 删除文件
  removeFile(fileId: string): void {
    const index = this.files.findIndex((f) => f.id === fileId);
    if (index !== -1) {
      // 如果正在上传，先取消上传
      if (this.files[index].uploader) {
        this.files[index].uploader.cancel();
      }
      // 从列表中删除
      this.files.splice(index, 1);
    }
  }

  // 获取所有文件
  getFiles(): FileUploadState[] {
    return [...this.files];
  }

  // 获取指定文件
  getFile(fileId: string): FileUploadState | undefined {
    return this.files.find((f) => f.id === fileId);
  }

  // 清除已完成的文件
  clearCompleted(): void {
    this.files = this.files.filter(
      (f) => f.progress.status !== "completed" && f.progress.status !== "error"
    );
  }

  // 清除所有文件
  clearAll(): void {
    // 取消所有上传中的文件
    this.files.forEach((file) => {
      if (file.uploader) {
        file.uploader.cancel();
      }
    });
    this.files = [];
  }

  // 设置进度回调
  onProgress(callback: (progress: UploadProgress) => void): void {
    this.onProgressCallback = callback;
  }

  // 设置错误回调
  onError(callback: (error: UploadError) => void): void {
    this.onErrorCallback = callback;
  }

  // 设置成功回调
  onSuccess(callback: (response: UploadResponse) => void): void {
    this.onSuccessCallback = callback;
  }
}
