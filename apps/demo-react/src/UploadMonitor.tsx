import React, { useState, useEffect } from "react";
import { Card, Progress, Alert, Button, Space, Typography, Tag } from "antd";
import {
  ReloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

interface UploadMonitorProps {
  fileId: string;
  fileName: string;
  status: string;
  progress: number;
  error?: string;
  onRetry?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const UploadMonitor: React.FC<UploadMonitorProps> = ({
  fileId,
  fileName,
  status,
  progress,
  error,
  onRetry,
  onPause,
  onResume,
}) => {
  const [lastProgress, setLastProgress] = useState(0);
  const [stuckTime, setStuckTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (status === "uploading") {
        if (progress === lastProgress) {
          setStuckTime((prev) => prev + 1);
        } else {
          setStuckTime(0);
          setLastProgress(progress);
        }
      } else {
        setStuckTime(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status, progress, lastProgress]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "error":
        return "error";
      case "uploading":
        return "processing";
      case "paused":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "等待中";
      case "hashing":
        return "计算哈希";
      case "verifying":
        return "验证文件";
      case "uploading":
        return "上传中";
      case "merging":
        return "合并分片";
      case "completed":
        return "已完成";
      case "error":
        return "上传失败";
      case "paused":
        return "已暂停";
      default:
        return status;
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <Text ellipsis style={{ maxWidth: 200 }}>
            {fileName}
          </Text>
          <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
        </Space>
      }
      extra={
        <Space>
          {status === "uploading" && (
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={onPause}
            >
              暂停
            </Button>
          )}
          {status === "paused" && (
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onResume}
            >
              继续
            </Button>
          )}
          {(status === "error" || stuckTime > 30) && (
            <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
              重试
            </Button>
          )}
        </Space>
      }
    >
      <div style={{ marginBottom: 8 }}>
        <Progress
          percent={progress}
          status={
            status === "error"
              ? "exception"
              : status === "completed"
              ? "success"
              : "active"
          }
          size="small"
        />
      </div>

      {stuckTime > 10 && status === "uploading" && (
        <Alert
          message={`上传似乎卡住了 (${stuckTime}秒无进度)`}
          type="warning"
          size="small"
          style={{ marginBottom: 8 }}
        />
      )}

      {error && (
        <Alert
          message="上传错误"
          description={error}
          type="error"
          size="small"
          showIcon
        />
      )}

      <div style={{ fontSize: 12, color: "#666" }}>文件ID: {fileId}</div>
    </Card>
  );
};

export default UploadMonitor;
