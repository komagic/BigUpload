/**
 * BigAntUploader - Ant Design styled component
 * 基于Ant Design设计系统的上传组件
 */

import React, { useCallback } from "react";
import {
  Upload,
  Button,
  Progress,
  List,
  Card,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
} from "antd";
import {
  UploadOutlined,
  InboxOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useBigUpload, UseBigUploadOptions } from "../../hooks/useBigUpload";
import { FileUploadState } from "../../core/BigUploadEngine";

const { Text, Title } = Typography;
const { Dragger } = Upload;

export interface BigAntUploaderProps extends UseBigUploadOptions {
  /** 组件类名 */
  className?: string;
  /** 组件样式 */
  style?: React.CSSProperties;
  /** 上传区域标题 */
  title?: string;
  /** 上传区域描述 */
  description?: string;
  /** 是否显示拖拽上传区域 */
  showDragger?: boolean;
  /** 是否显示文件列表 */
  showFileList?: boolean;
  /** 是否显示总体进度 */
  showTotalProgress?: boolean;
  /** 列表高度 */
  listHeight?: number;
  /** 成功回调 */
  onSuccess?: (fileId: string, result: any) => void;
  /** 错误回调 */
  onError?: (fileId: string, error: any) => void;
  /** 进度回调 */
  onProgress?: (fileId: string, progress: any) => void;
}

export interface BigAntUploaderRef {
  addFiles: (files: File[]) => Promise<string[]>;
  startUpload: (fileId?: string) => Promise<void>;
  pauseUpload: (fileId: string) => void;
  resumeUpload: (fileId: string) => Promise<void>;
  cancelUpload: (fileId: string) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
}

export const BigAntUploader = React.forwardRef<
  BigAntUploaderRef,
  BigAntUploaderProps
>(
  (
    {
      className,
      style,
      title = "文件上传",
      description = "支持拖拽上传，支持大文件分片上传、断点续传、秒传",
      showDragger = true,
      showFileList = true,
      showTotalProgress = true,
      listHeight = 400,
      onSuccess,
      onError,
      onProgress,
      ...uploadOptions
    },
    ref
  ) => {
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
        message.success(`文件上传成功: ${result.message}`);
        onSuccess?.(fileId, result);
      });

      const unsubscribeError = engine.on("error", ({ fileId, error }) => {
        message.error(`上传失败: ${error.message}`);
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

    // 暴露方法给父组件
    React.useImperativeHandle(
      ref,
      () => ({
        addFiles,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        removeFile,
        clearFiles,
      }),
      [
        addFiles,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        removeFile,
        clearFiles,
      ]
    );

    // 处理文件选择
    const handleFileSelect = useCallback(
      async (fileList: File[]) => {
        try {
          await addFiles(fileList);
          message.success(`成功添加 ${fileList.length} 个文件`);
        } catch (error: any) {
          message.error(`添加文件失败: ${error.message}`);
        }
      },
      [addFiles]
    );

    // 自定义上传逻辑
    const customUpload = useCallback(
      ({ file }: any) => {
        handleFileSelect([file]);
        return false; // 阻止默认上传
      },
      [handleFileSelect]
    );

    // 获取状态标签
    const getStatusTag = (status: FileUploadState["status"]) => {
      const configs = {
        pending: { color: "default", text: "等待中" },
        hashing: { color: "processing", text: "计算哈希" },
        verifying: { color: "processing", text: "验证文件" },
        uploading: { color: "processing", text: "上传中" },
        merging: { color: "processing", text: "合并中" },
        completed: { color: "success", text: "已完成" },
        error: { color: "error", text: "上传失败" },
        paused: { color: "warning", text: "已暂停" },
        cancelled: { color: "default", text: "已取消" },
      };

      const config = configs[status] || { color: "default", text: status };
      return <Tag color={config.color}>{config.text}</Tag>;
    };

    // 获取状态图标
    const getStatusIcon = (status: FileUploadState["status"]) => {
      switch (status) {
        case "completed":
          return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
        case "error":
          return <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />;
        case "uploading":
        case "hashing":
        case "verifying":
        case "merging":
          return (
            <Progress type="circle" size={16} percent={50} showInfo={false} />
          );
        case "paused":
          return <PauseCircleOutlined style={{ color: "#faad14" }} />;
        default:
          return null;
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

    // 渲染文件操作按钮
    const renderFileActions = (file: FileUploadState) => {
      const actions = [];

      if (file.status === "pending") {
        actions.push(
          <Button
            key="start"
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => startUpload(file.fileId)}
          >
            开始
          </Button>
        );
      }

      if (file.status === "uploading") {
        actions.push(
          <Button
            key="pause"
            size="small"
            icon={<PauseCircleOutlined />}
            onClick={() => pauseUpload(file.fileId)}
          >
            暂停
          </Button>
        );
      }

      if (file.status === "paused") {
        actions.push(
          <Button
            key="resume"
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => resumeUpload(file.fileId)}
          >
            继续
          </Button>
        );
      }

      if (file.status === "error" || file.status === "paused") {
        actions.push(
          <Button
            key="retry"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => startUpload(file.fileId)}
          >
            重试
          </Button>
        );
      }

      actions.push(
        <Popconfirm
          key="delete"
          title="确定要删除此文件吗？"
          onConfirm={() => removeFile(file.fileId)}
          okText="确定"
          cancelText="取消"
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      );

      return actions;
    };

    return (
      <div className={className} style={style}>
        <Card title={title}>
          {/* 拖拽上传区域 */}
          {showDragger && (
            <Dragger
              name="file"
              multiple
              customRequest={customUpload}
              showUploadList={false}
              accept={
                uploadOptions.accept?.includes("*/*")
                  ? undefined
                  : uploadOptions.accept?.join(",")
              }
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">{description}</p>
            </Dragger>
          )}

          {/* 普通上传按钮 */}
          {!showDragger && (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <Upload
                name="file"
                multiple
                customRequest={customUpload}
                showUploadList={false}
                accept={uploadOptions.accept?.join(",")}
              >
                <Button icon={<UploadOutlined />} size="large">
                  选择文件
                </Button>
              </Upload>
              <div style={{ marginTop: 8, color: "#666" }}>{description}</div>
            </div>
          )}

          {/* 总体进度 */}
          {showTotalProgress && files.length > 0 && (
            <Card
              size="small"
              title={
                <Space>
                  <span>总体进度</span>
                  <Tag color="blue">
                    {files.filter((f) => f.status === "completed").length}/
                    {files.length} 文件完成
                  </Tag>
                </Space>
              }
              extra={
                <Space>
                  {isUploading && (
                    <Button
                      size="small"
                      onClick={() => {
                        files.forEach((file) => {
                          if (file.status === "uploading") {
                            pauseUpload(file.fileId);
                          }
                        });
                      }}
                    >
                      全部暂停
                    </Button>
                  )}
                  <Button
                    size="small"
                    danger
                    onClick={clearFiles}
                    disabled={isUploading}
                  >
                    清空列表
                  </Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Progress
                percent={totalProgress.percent}
                status={isUploading ? "active" : "normal"}
                format={(percent) =>
                  `${percent}% (${formatFileSize(
                    totalProgress.loaded
                  )}/${formatFileSize(totalProgress.total)})`
                }
              />
            </Card>
          )}

          {/* 文件列表 */}
          {showFileList && files.length > 0 && (
            <Card size="small" title="文件列表">
              <List
                size="small"
                dataSource={files}
                style={{ maxHeight: listHeight, overflowY: "auto" }}
                renderItem={(file) => (
                  <List.Item
                    key={file.fileId}
                    actions={renderFileActions(file)}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(file.status)}
                      title={
                        <Space>
                          <Text ellipsis style={{ maxWidth: 200 }}>
                            {file.file.name}
                          </Text>
                          {getStatusTag(file.status)}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <Text type="secondary">
                              {formatFileSize(file.file.size)}
                            </Text>
                          </div>

                          {(file.status === "uploading" ||
                            file.status === "completed") && (
                            <Progress
                              percent={file.progress.percent}
                              size="small"
                              status={
                                file.status === "completed"
                                  ? "success"
                                  : "active"
                              }
                              format={(percent) =>
                                `${percent}% (${file.progress.uploadedChunks}/${file.progress.totalChunks} 分片)`
                              }
                            />
                          )}

                          {file.error && (
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {file.error.message}
                            </Text>
                          )}

                          {file.result && file.result.url && (
                            <div style={{ marginTop: 4 }}>
                              <a
                                href={file.result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                查看文件
                              </a>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Card>
      </div>
    );
  }
);

BigAntUploader.displayName = "BigAntUploader";

export default BigAntUploader;
