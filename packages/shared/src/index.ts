export interface ChunkInfo {
  fileId: string;
  chunkIndex: number;
  chunkSize: number;
  chunkTotal: number;
  currentChunkSize: number;
}

export interface UploadOptions {
  url: string;
  file: File;
  chunkSize: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  concurrent?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface FileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  fileType: string;
  uploadedChunks: number[];
  chunkSize: number;
  chunkTotal: number;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  status: "pending" | "uploading" | "paused" | "completed" | "error";
  speed?: number; // 上传速度 bytes/s
  remainingTime?: number; // 剩余时间（毫秒）
}

export interface UploadResponse {
  success: boolean;
  fileId?: string;
  url?: string;
  message?: string;
  completed?: boolean;
}

export interface VerifyResponse {
  exists: boolean;
  fileId?: string;
  url?: string;
  uploadedChunks?: number[];
  message?: string;
  success?: boolean;
  finish?: boolean;
}

// 前后端通用的文件哈希计算工具（Web版使用Web Workers实现）
export interface FileHasher {
  calculateHash(file: File | Buffer | string): Promise<string>;
}

// 错误类型
export enum UploadErrorType {
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  ABORT_ERROR = "ABORT_ERROR",
  HASH_CALCULATION_ERROR = "HASH_CALCULATION_ERROR",
}

export interface UploadError {
  type: UploadErrorType;
  message: string;
  chunkIndex?: number;
  retryable: boolean;
}

// API接口定义
export interface FastUploaderAPI {
  // 验证文件是否已存在
  verify(
    fileId: string,
    fileHash: string,
    fileName: string,
    fileSize: number
  ): Promise<VerifyResponse>;

  // 上传分片
  uploadChunk(
    chunk: Blob | Buffer,
    chunkInfo: ChunkInfo
  ): Promise<UploadResponse>;

  // 合并分片
  mergeChunks(fileInfo: FileInfo): Promise<UploadResponse>;
}
