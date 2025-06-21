/**
 * React Hook for BigUpload
 * 基于核心引擎提供React专用的接口
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BigUploadEngine,
  UploadConfig,
  FileUploadState,
  UploadProgress,
  UploadError,
  UploadResult,
} from "../core/BigUploadEngine";

export interface UseBigUploadOptions extends Omit<UploadConfig, "baseUrl"> {
  /** 后端API基础URL */
  baseUrl: string;
  /** 自动开始上传 */
  autoStart?: boolean;
  /** 最大文件数量 */
  maxFiles?: number;
  /** 允许的文件类型 */
  accept?: string[];
  /** 单个文件最大大小 */
  maxFileSize?: number;
}

export interface UseBigUploadReturn {
  /** 上传引擎实例 */
  engine: BigUploadEngine;
  /** 所有文件状态 */
  files: FileUploadState[];
  /** 是否有文件正在上传 */
  isUploading: boolean;
  /** 添加文件 */
  addFiles: (files: FileList | File[]) => Promise<string[]>;
  /** 开始上传 */
  startUpload: (fileId?: string) => Promise<void>;
  /** 暂停上传 */
  pauseUpload: (fileId: string) => void;
  /** 继续上传 */
  resumeUpload: (fileId: string) => Promise<void>;
  /** 取消上传 */
  cancelUpload: (fileId: string) => void;
  /** 移除文件 */
  removeFile: (fileId: string) => void;
  /** 清空所有文件 */
  clearFiles: () => void;
  /** 获取总体进度 */
  totalProgress: UploadProgress;
}

export function useBigUpload(options: UseBigUploadOptions): UseBigUploadReturn {
  const engineRef = useRef<BigUploadEngine | null>(null);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 初始化引擎
  useEffect(() => {
    const engine = new BigUploadEngine({
      baseUrl: options.baseUrl,
      chunkSize: options.chunkSize,
      concurrent: options.concurrent,
      retryDelays: options.retryDelays,
      headers: options.headers,
      debug: options.debug,
    });

    engineRef.current = engine;

    // 监听状态变化
    const unsubscribeStateChange = engine.on(
      "stateChange",
      ({ fileId, state }) => {
        setFiles((prevFiles) => {
          const newFiles = [...prevFiles];
          const index = newFiles.findIndex((f) => f.fileId === fileId);
          if (index >= 0) {
            newFiles[index] = state;
          } else {
            newFiles.push(state);
          }
          return newFiles;
        });
      }
    );

    // 监听上传状态
    const unsubscribeProgress = engine.on("progress", () => {
      updateUploadingStatus(engine);
    });

    const unsubscribeSuccess = engine.on("success", () => {
      updateUploadingStatus(engine);
    });

    const unsubscribeError = engine.on("error", () => {
      updateUploadingStatus(engine);
    });

    return () => {
      unsubscribeStateChange();
      unsubscribeProgress();
      unsubscribeSuccess();
      unsubscribeError();
    };
  }, [options.baseUrl]);

  // 更新上传状态
  const updateUploadingStatus = useCallback((engine: BigUploadEngine) => {
    const allFiles = engine.getAllFiles();
    const uploading = allFiles.some(
      (f) =>
        f.status === "hashing" ||
        f.status === "verifying" ||
        f.status === "uploading" ||
        f.status === "merging"
    );
    setIsUploading(uploading);
  }, []);

  // 验证文件
  const validateFile = useCallback(
    (file: File): string | null => {
      // 检查文件类型
      if (options.accept && options.accept.length > 0) {
        const fileExtension = file.name.split(".").pop()?.toLowerCase();
        const mimeType = file.type.toLowerCase();

        const isValidType = options.accept.some((accept) => {
          // 处理通配符
          if (accept === "*" || accept === "*/*") {
            return true;
          }
          if (accept.startsWith(".")) {
            return accept.toLowerCase() === `.${fileExtension}`;
          }
          if (accept.includes("/")) {
            const acceptLower = accept.toLowerCase();
            if (acceptLower.endsWith("/*")) {
              // 处理通配符，如 "text/*"
              const baseType = acceptLower.slice(0, -2); // 移除 "/*"
              return mimeType.startsWith(baseType + "/");
            } else {
              // 精确匹配
              return mimeType === acceptLower;
            }
          }
          return false;
        });
        if (!isValidType) {
          return `不支持的文件类型: ${file.name}`;
        }
      }

      // 检查文件大小
      if (options.maxFileSize && file.size > options.maxFileSize) {
        return `文件过大: ${file.name} (${formatFileSize(
          file.size
        )} > ${formatFileSize(options.maxFileSize)})`;
      }

      return null;
    },
    [options.accept, options.maxFileSize]
  );

  // 添加文件
  const addFiles = useCallback(
    async (fileList: FileList | File[]): Promise<string[]> => {
      const engine = engineRef.current;
      if (!engine) throw new Error("Upload engine not initialized");

      const filesArray = Array.from(fileList);

      // 检查文件数量限制
      if (options.maxFiles) {
        const currentCount = engine.getAllFiles().length;
        const newCount = currentCount + filesArray.length;
        if (newCount > options.maxFiles) {
          throw new Error(`最多只能上传 ${options.maxFiles} 个文件`);
        }
      }

      const fileIds: string[] = [];
      const errors: string[] = [];

      for (const file of filesArray) {
        // 验证文件
        const error = validateFile(file);
        if (error) {
          errors.push(error);
          continue;
        }

        try {
          const fileId = await engine.addFile(file);
          fileIds.push(fileId);

          // 自动开始上传
          if (options.autoStart) {
            engine.startUpload(fileId);
          }
        } catch (error) {
          errors.push(`添加文件失败: ${file.name} - ${error}`);
        }
      }

      if (errors.length > 0) {
        console.warn("文件添加警告:", errors);
      }

      return fileIds;
    },
    [options.autoStart, options.maxFiles, validateFile]
  );

  // 开始上传
  const startUpload = useCallback(async (fileId?: string): Promise<void> => {
    const engine = engineRef.current;
    if (!engine) throw new Error("Upload engine not initialized");

    if (fileId) {
      // 上传指定文件
      await engine.startUpload(fileId);
    } else {
      // 上传所有待上传的文件
      const allFiles = engine.getAllFiles();
      const pendingFiles = allFiles.filter((f) => f.status === "pending");

      for (const file of pendingFiles) {
        engine.startUpload(file.fileId);
      }
    }
  }, []);

  // 暂停上传
  const pauseUpload = useCallback((fileId: string): void => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pauseUpload(fileId);
  }, []);

  // 继续上传
  const resumeUpload = useCallback(async (fileId: string): Promise<void> => {
    const engine = engineRef.current;
    if (!engine) throw new Error("Upload engine not initialized");
    await engine.resumeUpload(fileId);
  }, []);

  // 取消上传
  const cancelUpload = useCallback((fileId: string): void => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.cancelUpload(fileId);
  }, []);

  // 移除文件
  const removeFile = useCallback((fileId: string): void => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.removeFile(fileId);
    setFiles((prevFiles) => prevFiles.filter((f) => f.fileId !== fileId));
  }, []);

  // 清空所有文件
  const clearFiles = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;

    const allFiles = engine.getAllFiles();
    allFiles.forEach((file) => {
      engine.removeFile(file.fileId);
    });
    setFiles([]);
  }, []);

  // 计算总体进度
  const totalProgress: UploadProgress = {
    loaded: files.reduce((sum, file) => sum + file.progress.loaded, 0),
    total: files.reduce((sum, file) => sum + file.progress.total, 0),
    percent: 0,
    speed: files.reduce((sum, file) => sum + file.progress.speed, 0),
    remainingTime: 0,
    uploadedChunks: files.reduce(
      (sum, file) => sum + file.progress.uploadedChunks,
      0
    ),
    totalChunks: files.reduce(
      (sum, file) => sum + file.progress.totalChunks,
      0
    ),
  };

  if (totalProgress.total > 0) {
    totalProgress.percent = Math.round(
      (totalProgress.loaded / totalProgress.total) * 100
    );
  }

  if (totalProgress.speed > 0) {
    totalProgress.remainingTime = Math.round(
      (totalProgress.total - totalProgress.loaded) / totalProgress.speed
    );
  }

  return {
    engine: engineRef.current!,
    files,
    isUploading,
    addFiles,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    removeFile,
    clearFiles,
    totalProgress,
  };
}

// 辅助函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
