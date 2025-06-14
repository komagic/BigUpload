/**
 * BigUploader React Component
 * 基于核心引擎的React上传组件
 */

import React, { useCallback, useRef } from "react";
import { useBigUpload, UseBigUploadOptions } from "../../hooks/useBigUpload";
import { FileUploadState } from "../../core/BigUploadEngine";

export interface BigUploaderProps extends UseBigUploadOptions {
  /** 组件类名 */
  className?: string;
  /** 组件样式 */
  style?: React.CSSProperties;
  /** 是否禁用 */
  disabled?: boolean;
  /** 拖拽上传区域文本 */
  dragText?: string;
  /** 点击上传按钮文本 */
  buttonText?: string;
  /** 是否显示文件列表 */
  showFileList?: boolean;
  /** 是否显示总体进度 */
  showTotalProgress?: boolean;
  /** 自定义文件列表渲染 */
  renderFileList?: (files: FileUploadState[]) => React.ReactNode;
  /** 成功回调 */
  onSuccess?: (fileId: string, result: any) => void;
  /** 错误回调 */
  onError?: (fileId: string, error: any) => void;
  /** 进度回调 */
  onProgress?: (fileId: string, progress: any) => void;
}

export const BigUploader: React.FC<BigUploaderProps> = ({
  className,
  style,
  disabled = false,
  dragText = "拖拽文件到此处或点击上传",
  buttonText = "选择文件",
  showFileList = true,
  showTotalProgress = true,
  renderFileList,
  onSuccess,
  onError,
  onProgress,
  ...uploadOptions
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const {
    engine,
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
  } = useBigUpload(uploadOptions);

  // 设置事件监听
  React.useEffect(() => {
    if (!engine) return;

    const unsubscribeSuccess = engine.on("success", ({ fileId, result }) => {
      onSuccess?.(fileId, result);
    });

    const unsubscribeError = engine.on("error", ({ fileId, error }) => {
      onError?.(fileId, error);
    });

    const unsubscribeProgress = engine.on(
      "progress",
      ({ fileId, progress }) => {
        onProgress?.(fileId, progress);
      }
    );

    return () => {
      unsubscribeSuccess();
      unsubscribeError();
      unsubscribeProgress();
    };
  }, [engine, onSuccess, onError, onProgress]);

  // 处理文件选择
  const handleFileSelect = useCallback(
    async (fileList: FileList) => {
      if (disabled) return;

      try {
        await addFiles(fileList);
      } catch (error) {
        console.error("添加文件失败:", error);
        onError?.("", error);
      }
    },
    [disabled, addFiles, onError]
  );

  // 处理点击上传
  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  // 处理拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [disabled, handleFileSelect]
  );

  // 文件状态图标
  const getStatusIcon = (status: FileUploadState["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "hashing":
        return "🔄";
      case "verifying":
        return "🔍";
      case "uploading":
        return "⬆️";
      case "merging":
        return "🔗";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      case "paused":
        return "⏸️";
      case "cancelled":
        return "🚫";
      default:
        return "📄";
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 渲染进度条
  const renderProgressBar = (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => (
    <div
      style={{
        width: "100%",
        backgroundColor: "#f0f0f0",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress.percent}%`,
          height: "8px",
          backgroundColor: "#1890ff",
          transition: "width 0.3s ease",
        }}
      />
      <div style={{ fontSize: "12px", marginTop: "4px", color: "#666" }}>
        {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)} (
        {progress.percent}%)
      </div>
    </div>
  );

  // 默认文件列表渲染
  const defaultRenderFileList = (files: FileUploadState[]) => (
    <div style={{ marginTop: "16px" }}>
      {files.map((file) => (
        <div
          key={file.fileId}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px",
            border: "1px solid #d9d9d9",
            borderRadius: "6px",
            marginBottom: "8px",
            backgroundColor: "#fafafa",
          }}
        >
          <span style={{ marginRight: "8px", fontSize: "16px" }}>
            {getStatusIcon(file.status)}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: "bold",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.file.name}
            </div>
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              {formatFileSize(file.file.size)} • {file.status}
            </div>
            {(file.status === "uploading" || file.status === "completed") && (
              <div style={{ marginTop: "8px" }}>
                {renderProgressBar(file.progress)}
              </div>
            )}
            {file.error && (
              <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                {file.error.message}
              </div>
            )}
          </div>

          <div style={{ marginLeft: "12px" }}>
            {file.status === "pending" && (
              <button
                onClick={() => startUpload(file.fileId)}
                style={{
                  marginRight: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                }}
              >
                开始
              </button>
            )}
            {file.status === "uploading" && (
              <button
                onClick={() => pauseUpload(file.fileId)}
                style={{
                  marginRight: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                }}
              >
                暂停
              </button>
            )}
            {file.status === "paused" && (
              <button
                onClick={() => resumeUpload(file.fileId)}
                style={{
                  marginRight: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                }}
              >
                继续
              </button>
            )}
            {(file.status === "error" || file.status === "paused") && (
              <button
                onClick={() => startUpload(file.fileId)}
                style={{
                  marginRight: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                }}
              >
                重试
              </button>
            )}
            <button
              onClick={() => removeFile(file.fileId)}
              style={{ padding: "4px 8px", fontSize: "12px", color: "red" }}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={className} style={style}>
      {/* 拖拽上传区域 */}
      <div
        ref={dropAreaRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: "2px dashed #d9d9d9",
          borderRadius: "6px",
          padding: "40px 20px",
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          backgroundColor: disabled ? "#f5f5f5" : "#fafafa",
          transition: "border-color 0.3s ease",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📁</div>
        <div style={{ fontSize: "16px", marginBottom: "8px" }}>{dragText}</div>
        <button
          type="button"
          disabled={disabled}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            backgroundColor: disabled ? "#f5f5f5" : "#1890ff",
            color: disabled ? "#bfbfbf" : "white",
            border: "none",
            borderRadius: "4px",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {buttonText}
        </button>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) {
            handleFileSelect(e.target.files);
            e.target.value = ""; // 清空输入，允许重复选择同一文件
          }
        }}
        accept={uploadOptions.accept?.join(",")}
      />

      {/* 总体进度 */}
      {showTotalProgress && files.length > 0 && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: "#f0f0f0",
            borderRadius: "6px",
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
            总体进度 ({files.filter((f) => f.status === "completed").length}/
            {files.length} 文件完成)
          </div>
          {renderProgressBar(totalProgress)}
          {isUploading && (
            <div style={{ marginTop: "8px" }}>
              <button
                onClick={() => {
                  files.forEach((file) => {
                    if (file.status === "uploading") {
                      pauseUpload(file.fileId);
                    }
                  });
                }}
                style={{
                  marginRight: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                }}
              >
                全部暂停
              </button>
              <button
                onClick={clearFiles}
                style={{ padding: "4px 8px", fontSize: "12px", color: "red" }}
              >
                清空列表
              </button>
            </div>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {showFileList && files.length > 0 && (
        <div>
          {renderFileList
            ? renderFileList(files)
            : defaultRenderFileList(files)}
        </div>
      )}
    </div>
  );
};

export default BigUploader;
