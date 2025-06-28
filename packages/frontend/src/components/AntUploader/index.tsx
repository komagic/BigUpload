import React, { useState, useEffect } from "react";
import { Upload, Button, Progress, Card, List, Space, message } from "antd";
import {
  UploadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import { UploadManager, FileUploadState } from "../../utils/UploadManager";
import { UploadProgress, UploadResponse, UploadError } from "bigupload-shared";

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 格式化速度
const formatSpeed = (bytesPerSecond: number): string => {
  return formatFileSize(bytesPerSecond) + "/s";
};

// 格式化剩余时间
const formatRemainingTime = (ms: number): string => {
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

export interface AntUploaderProps {
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

  // 上传成功回调
  onSuccess?: (response: UploadResponse) => void;

  // 上传错误回调
  onError?: (error: UploadError) => void;

  // 上传进度回调
  onProgress?: (progress: UploadProgress) => void;
}

const AntUploader: React.FC<AntUploaderProps> = ({
  url,
  maxFileSize = 0,
  accept,
  chunkSize = 2 * 1024 * 1024,
  concurrent = 3,
  autoUpload = true,
  headers,
  multiple = false,
  onSuccess,
  onError,
  onProgress,
}) => {
  const [uploadManager] = useState<UploadManager>(
    () =>
      new UploadManager(url, {
        maxFileSize,
        chunkSize,
        concurrent,
        headers,
        autoUpload,
      })
  );
  const [files, setFiles] = useState<FileUploadState[]>([]);

  // 初始化上传管理器的回调
  useEffect(() => {
    // 设置进度回调
    uploadManager.onProgress((progress) => {
      onProgress?.(progress);
      setFiles([...uploadManager.getFiles()]);
    });

    // 设置错误回调
    uploadManager.onError((error) => {
      onError?.(error);
      message.error(`上传错误: ${error.message}`);
      setFiles([...uploadManager.getFiles()]);
    });

    // 设置成功回调
    uploadManager.onSuccess((response) => {
      onSuccess?.(response);
      message.success(`上传成功: ${response.message || "文件已上传"}`);
      setFiles([...uploadManager.getFiles()]);
    });
  }, [uploadManager, onProgress, onError, onSuccess]);

  // 自定义上传处理
  const customUploadRequest: UploadProps["customRequest"] = ({
    file,
    onError,
  }) => {
    try {
      // 将文件添加到上传管理器
      if (file instanceof File) {
        uploadManager.addFiles([file]);
        setFiles([...uploadManager.getFiles()]);
      } else {
        throw new Error("不支持的文件类型");
      }
    } catch (err) {
      onError?.(err as any);
    }
  };

  // 暂停上传
  const handlePause = (fileId: string) => {
    uploadManager.pauseUpload(fileId);
    setFiles([...uploadManager.getFiles()]);
  };

  // 继续上传
  const handleResume = (fileId: string) => {
    uploadManager.resumeUpload(fileId);
    setFiles([...uploadManager.getFiles()]);
  };

  // 移除文件
  const handleRemove = (fileId: string) => {
    uploadManager.removeFile(fileId);
    setFiles([...uploadManager.getFiles()]);
  };

  // 清除已完成的文件
  const handleClearCompleted = () => {
    uploadManager.clearCompleted();
    setFiles([...uploadManager.getFiles()]);
  };

  // 生成状态文本
  const getStatusText = (fileState: FileUploadState) => {
    const { progress } = fileState;
    switch (progress.status) {
      case "pending":
        return "等待上传";
      case "uploading":
        return `上传中 ${progress.percent}%`;
      case "paused":
        return "已暂停";
      case "completed":
        return "上传完成";
      case "error":
        return `上传失败: ${fileState.error?.message}`;
      default:
        return "未知状态";
    }
  };

  return (
    <div className="ant-uploader">
      <Upload
        customRequest={customUploadRequest}
        showUploadList={false}
        accept={accept}
        multiple={multiple}
      >
        <Button icon={<UploadOutlined />}>选择文件</Button>
      </Upload>

      {files.length > 0 && (
        <Card
          title="上传列表"
          style={{ marginTop: 16 }}
          extra={
            <Button size="small" onClick={handleClearCompleted}>
              清除已完成
            </Button>
          }
        >
          <List
            itemLayout="horizontal"
            dataSource={files}
            renderItem={(fileState) => (
              <List.Item
                key={fileState.id}
                actions={[
                  fileState.progress.status === "uploading" ? (
                    <PauseCircleOutlined
                      onClick={() => handlePause(fileState.id)}
                      title="暂停"
                      style={{ fontSize: "18px" }}
                    />
                  ) : fileState.progress.status === "paused" ? (
                    <PlayCircleOutlined
                      onClick={() => handleResume(fileState.id)}
                      title="继续"
                      style={{ fontSize: "18px" }}
                    />
                  ) : null,
                  <DeleteOutlined
                    onClick={() => handleRemove(fileState.id)}
                    title="移除"
                    style={{ fontSize: "18px" }}
                  />,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={fileState.file.name}
                  description={
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <div>
                        {`${formatFileSize(
                          fileState.progress.loaded
                        )} / ${formatFileSize(fileState.progress.total)}`}
                        {fileState.progress.speed
                          ? ` - ${formatSpeed(fileState.progress.speed)}`
                          : ""}
                        {fileState.progress.remainingTime
                          ? ` - 剩余时间: ${formatRemainingTime(
                              fileState.progress.remainingTime
                            )}`
                          : ""}
                      </div>
                      <Progress
                        percent={fileState.progress.percent}
                        status={
                          fileState.progress.status === "error"
                            ? "exception"
                            : fileState.progress.status === "completed"
                            ? "success"
                            : fileState.progress.status === "paused"
                            ? "normal"
                            : "active"
                        }
                        size="small"
                      />
                      <div style={{ color: "#999" }}>
                        {getStatusText(fileState)}
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default AntUploader;
