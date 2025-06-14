import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  UploadOptions,
  UploadProgress,
  UploadResponse,
  UploadError,
  UploadErrorType,
} from "@bigupload/shared";
import { UploaderService } from "./UploaderService";

// 文件大小格式化
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 格式化时间
const formatTime = (ms: number): string => {
  if (!ms || ms < 0) return "--:--";

  // 毫秒转秒
  let seconds = Math.floor(ms / 1000);

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
};

// 格式化速度
const formatSpeed = (bytesPerSecond: number): string => {
  return formatFileSize(bytesPerSecond) + "/s";
};

export interface FastUploaderProps {
  // 上传地址
  url: string;

  // 文件大小限制（字节）
  maxFileSize?: number;

  // 允许的文件类型
  accept?: string;

  // 分片大小（字节）
  chunkSize?: number;

  // 并发上传数
  concurrent?: number;

  // 是否自动上传
  autoUpload?: boolean;

  // 自定义HTTP头
  headers?: Record<string, string>;

  // 多个文件同时上传
  multiple?: boolean;

  // 拖拽上传
  dragDrop?: boolean;

  // 上传成功回调
  onSuccess?: (response: UploadResponse) => void;

  // 上传错误回调
  onError?: (error: UploadError) => void;

  // 上传进度回调
  onProgress?: (progress: UploadProgress) => void;

  // 样式类名
  className?: string;

  // 子元素
  children?: React.ReactNode;
}

// 单个文件上传状态
interface FileUploadState {
  id: string; // 内部唯一id
  file: File;
  progress: UploadProgress;
  uploader?: UploaderService;
  error?: UploadError;
}

const FastUploader: React.FC<FastUploaderProps> = ({
  url,
  maxFileSize = 0, // 0表示不限制
  accept,
  chunkSize = 2 * 1024 * 1024, // 默认2MB
  concurrent = 3,
  autoUpload = true,
  headers,
  multiple = false,
  dragDrop = true,
  onSuccess,
  onError,
  onProgress,
  className = "",
  children,
}) => {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles?.length) return;

      const newFiles: FileUploadState[] = [];

      // 检查文件大小限制
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // 文件大小检查
        if (maxFileSize > 0 && file.size > maxFileSize) {
          onError?.({
            type: UploadErrorType.FILE_TOO_LARGE,
            message: `文件大小超过限制 (${formatFileSize(
              file.size
            )} > ${formatFileSize(maxFileSize)})`,
            retryable: false,
          });
          continue;
        }

        // 创建文件状态对象
        const fileState: FileUploadState = {
          id: `upload-${Date.now()}-${i}`,
          file,
          progress: {
            fileId: "",
            fileName: file.name,
            loaded: 0,
            total: file.size,
            percent: 0,
            status: "pending",
          },
        };

        newFiles.push(fileState);
      }

      // 多文件模式
      if (multiple) {
        setFiles((prev) => [...prev, ...newFiles]);
      } else {
        // 单文件模式，替换现有文件
        setFiles(newFiles);
      }

      // 自动开始上传
      if (autoUpload && newFiles.length > 0) {
        setTimeout(() => {
          newFiles.forEach((file) => startUpload(file));
        }, 0);
      }
    },
    [maxFileSize, autoUpload, multiple, onError]
  );

  // 开始上传
  const startUpload = useCallback(
    (fileState: FileUploadState) => {
      // 创建上传选项
      const options: UploadOptions = {
        url,
        file: fileState.file,
        chunkSize,
        headers,
        concurrent,
        withCredentials: true,
      };

      // 创建上传服务
      const uploader = new UploaderService(options);

      // 监听进度
      uploader.onProgress((progress) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileState.id ? { ...f, progress } : f))
        );

        // 转发进度回调
        onProgress?.(progress);
      });

      // 监听错误
      uploader.onError((error) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileState.id ? { ...f, error } : f))
        );

        // 转发错误回调
        onError?.(error);
      });

      // 监听成功
      uploader.onSuccess((response) => {
        // 转发成功回调
        onSuccess?.(response);
      });

      // 保存上传器实例
      setFiles((prev) =>
        prev.map((f) => (f.id === fileState.id ? { ...f, uploader } : f))
      );

      // 开始上传
      uploader.start();
    },
    [url, chunkSize, headers, concurrent, onProgress, onError, onSuccess]
  );

  // 暂停上传
  const pauseUpload = useCallback((fileState: FileUploadState) => {
    fileState.uploader?.pause();
  }, []);

  // 继续上传
  const resumeUpload = useCallback((fileState: FileUploadState) => {
    fileState.uploader?.resume();
  }, []);

  // 取消上传
  const cancelUpload = useCallback((fileState: FileUploadState) => {
    fileState.uploader?.cancel();

    // 从列表中移除
    setFiles((prev) => prev.filter((f) => f.id !== fileState.id));
  }, []);

  // 重试上传
  const retryUpload = useCallback(
    (fileState: FileUploadState) => {
      // 重置错误状态
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileState.id ? { ...f, error: undefined } : f
        )
      );

      // 重新开始上传
      startUpload(fileState);
    },
    [startUpload]
  );

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // 处理拖放的文件
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // 打开文件选择对话框
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // 清除已完成的上传
  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.progress.status !== "completed"));
  };

  return (
    <div
      className={`fast-uploader ${className} ${isDragOver ? "drag-over" : ""}`}
      onDragOver={dragDrop ? handleDragOver : undefined}
      onDragLeave={dragDrop ? handleDragLeave : undefined}
      onDrop={dragDrop ? handleDrop : undefined}
    >
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* 自定义上传触发器 */}
      {children ? (
        <div onClick={openFileDialog}>{children}</div>
      ) : (
        <div className="upload-trigger" onClick={openFileDialog}>
          {dragDrop ? (
            <div className="upload-area">
              <div className="upload-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v9m0 0l3-3m-3 3l-3-3m12 5v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3" />
                </svg>
              </div>
              <div className="upload-text">
                <p>拖放文件到此处上传</p>
                <p>或点击选择文件</p>
              </div>
            </div>
          ) : (
            <button className="upload-button">选择文件</button>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="upload-file-list">
          <div className="upload-header">
            <h3>上传文件列表</h3>
            {files.some((f) => f.progress.status === "completed") && (
              <button className="clear-button" onClick={clearCompleted}>
                清除已完成
              </button>
            )}
          </div>

          {files.map((fileState) => (
            <div key={fileState.id} className="upload-file-item">
              <div className="file-info">
                <div className="file-name">{fileState.file.name}</div>
                <div className="file-size">
                  {formatFileSize(fileState.file.size)}
                </div>
              </div>

              <div className="upload-progress">
                <div className="progress-bar">
                  <div
                    className={`progress-inner ${fileState.progress.status}`}
                    style={{ width: `${fileState.progress.percent}%` }}
                  ></div>
                </div>

                <div className="progress-info">
                  {fileState.error ? (
                    <div className="error-message">
                      {fileState.error.message}
                    </div>
                  ) : (
                    <div className="progress-text">
                      <span>{fileState.progress.percent}%</span>
                      {fileState.progress.status === "uploading" && (
                        <>
                          <span className="speed">
                            {formatSpeed(fileState.progress.speed || 0)}
                          </span>
                          <span className="time-left">
                            剩余时间:{" "}
                            {formatTime(fileState.progress.remainingTime || 0)}
                          </span>
                        </>
                      )}
                      <span className="status">
                        {fileState.progress.status === "pending" &&
                          "准备上传..."}
                        {fileState.progress.status === "uploading" &&
                          "上传中..."}
                        {fileState.progress.status === "paused" && "已暂停"}
                        {fileState.progress.status === "completed" &&
                          "上传完成"}
                        {fileState.progress.status === "error" && "上传失败"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="file-actions">
                {fileState.progress.status === "uploading" && (
                  <button
                    className="action-button pause"
                    onClick={() => pauseUpload(fileState)}
                  >
                    暂停
                  </button>
                )}

                {fileState.progress.status === "paused" && (
                  <button
                    className="action-button resume"
                    onClick={() => resumeUpload(fileState)}
                  >
                    继续
                  </button>
                )}

                {fileState.progress.status === "error" && (
                  <button
                    className="action-button retry"
                    onClick={() => retryUpload(fileState)}
                  >
                    重试
                  </button>
                )}

                {fileState.progress.status !== "completed" && (
                  <button
                    className="action-button cancel"
                    onClick={() => cancelUpload(fileState)}
                  >
                    取消
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .fast-uploader {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
          width: 100%;
          max-width: 800px;
          padding: 20px;
          margin: 0 auto;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .fast-uploader.drag-over {
          background-color: rgba(0, 120, 255, 0.05);
          border: 2px dashed #0078ff;
        }

        .upload-trigger {
          cursor: pointer;
        }

        .upload-area {
          border: 2px dashed #d9d9d9;
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          transition: all 0.3s;
        }

        .upload-area:hover {
          border-color: #0078ff;
        }

        .upload-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 16px;
          color: #0078ff;
        }

        .upload-text {
          color: #666;
        }

        .upload-text p {
          margin: 4px 0;
        }

        .upload-button {
          background-color: #0078ff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .upload-button:hover {
          background-color: #0056cc;
        }

        .upload-file-list {
          margin-top: 20px;
        }

        .upload-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .upload-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .clear-button {
          background: none;
          border: none;
          color: #0078ff;
          cursor: pointer;
          font-size: 14px;
        }

        .upload-file-item {
          padding: 15px;
          border-radius: 4px;
          background-color: #f9f9f9;
          margin-bottom: 10px;
        }

        .file-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .file-name {
          font-weight: 500;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 70%;
        }

        .file-size {
          color: #888;
          font-size: 14px;
        }

        .upload-progress {
          margin-bottom: 10px;
        }

        .progress-bar {
          height: 8px;
          background-color: #e6e6e6;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 5px;
        }

        .progress-inner {
          height: 100%;
          background-color: #0078ff;
          transition: width 0.3s ease;
        }

        .progress-inner.paused {
          background-color: #f8c100;
        }

        .progress-inner.error {
          background-color: #ff4d4f;
        }

        .progress-inner.completed {
          background-color: #52c41a;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .progress-text {
          display: flex;
          gap: 10px;
          color: #666;
        }

        .error-message {
          color: #ff4d4f;
        }

        .file-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .action-button {
          border: none;
          background: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .action-button.pause {
          color: #f8c100;
        }

        .action-button.resume {
          color: #0078ff;
        }

        .action-button.retry {
          color: #0078ff;
        }

        .action-button.cancel {
          color: #ff4d4f;
        }

        .action-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        @media (max-width: 576px) {
          .fast-uploader {
            padding: 15px;
          }

          .upload-area {
            padding: 20px 10px;
          }

          .progress-text {
            flex-direction: column;
            gap: 2px;
          }

          .file-actions {
            margin-top: 10px;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default FastUploader;
