import React, { useState, useRef, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Upload,
  Button,
  Progress,
  Space,
  Typography,
  Divider,
  message,
  List,
  Tag,
  Statistic,
  Alert,
  Switch,
  Input,
  Tooltip,
  Badge,
  Select,
} from "antd";
import {
  UploadOutlined,
  InboxOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  createUploadEngine,
  formatFileSize,
  type UploadProgress,
  type UploadResult,
  type UploadError,
} from "bigupload-frontend";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface ServerConfig {
  name: string;
  url: string;
  port: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  serverName: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  speed: number;
  elapsedTime: number;
  error?: string;
  result?: any;
  startTime: number;
}

const servers: ServerConfig[] = [
  {
    name: "Node.js",
    url: "http://localhost:3000",
    port: 3000,
    icon: <CloudServerOutlined />,
    color: "#52c41a",
    description: "Express + TypeScript + Multer",
  },
  {
    name: "Python",
    url: "http://localhost:5000",
    port: 5000,
    icon: <ThunderboltOutlined />,
    color: "#1890ff",
    description: "FastAPI + uvloop + aiofiles",
  },
  {
    name: "Java",
    url: "http://localhost:8080",
    port: 8080,
    icon: <RocketOutlined />,
    color: "#fa8c16",
    description: "Spring Boot + Maven",
  },
];

export const MultiServerUploadTest: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [serverStatus, setServerStatus] = useState<{
    [key: string]: "online" | "offline" | "checking";
  }>({});
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState(0.8); // 默认 0.8MB - Uppy 最佳实践

  const uploadEnginesRef = useRef<{ [key: string]: any }>({});

  // 检测硬件并发能力并显示信息
  const hardwareInfo = React.useMemo(() => {
    const hwConcurrency = navigator.hardwareConcurrency || 4;
    const optimalConcurrency =
      hwConcurrency <= 2
        ? 1
        : hwConcurrency <= 4
        ? 2
        : hwConcurrency <= 8
        ? 3
        : Math.min(4, Math.floor(hwConcurrency / 2));

    return {
      cores: hwConcurrency,
      optimalConcurrency,
      chunkSize: chunkSize,
    };
  }, [chunkSize]);

  // 初始化上传引擎 - 基于 Uppy 最佳实践
  React.useEffect(() => {
    servers.forEach((server) => {
      const apiConfig = getServerApiConfig(server);
      uploadEnginesRef.current[server.name] = createUploadEngine(server.url, {
        debug: true,
        chunkSize: chunkSize * 1024 * 1024, // 0.8MB 默认分片大小
        useHardwareConcurrency: true, // 启用硬件感知并发
        retryDelays: [0, 1000, 3000, 5000, 10000], // TUS 风格重试延迟
        apiPaths: apiConfig,
      });
    });

    return () => {
      // 清理资源
      Object.values(uploadEnginesRef.current).forEach((engine: any) => {
        if (engine && engine.destroy) {
          engine.destroy();
        }
      });
    };
  }, [chunkSize]);

  // 获取服务器API配置 - 为每个后端配置正确的API路径
  const getServerApiConfig = (server: ServerConfig) => {
    if (server.name === "Node.js") {
      // Node.js 使用直接路径
      return {
        verify: "/verify",
        upload: "/upload-chunk",
        merge: "/merge-chunks",
      };
    } else if (server.name === "Python") {
      // Python 使用 /api/upload 前缀，且 API 名称不同
      return {
        verify: "/api/upload/verify",
        upload: "/api/upload/upload", // 注意：Python 是 "upload" 不是 "upload-chunk"
        merge: "/api/upload/merge", // 注意：Python 是 "merge" 不是 "merge-chunks"
      };
    } else if (server.name === "Java") {
      // Java 使用 /api/upload 前缀
      return {
        verify: "/api/upload/verify",
        upload: "/api/upload/upload-chunk",
        merge: "/api/upload/merge-chunks",
      };
    } else {
      // 默认配置（Node.js 风格）
      return {
        verify: "/verify",
        upload: "/upload-chunk",
        merge: "/merge-chunks",
      };
    }
  };

  // 检查服务器状态
  const checkServerStatus = useCallback(async (server: ServerConfig) => {
    setServerStatus((prev) => ({ ...prev, [server.name]: "checking" }));

    try {
      // 根据不同后端使用不同的健康检查路径
      let healthUrl: string;
      if (server.name === "Node.js") {
        healthUrl = `${server.url}/health`;
      } else if (server.name === "Python") {
        healthUrl = `${server.url}/api/upload/health`;
      } else if (server.name === "Java") {
        healthUrl = `${server.url}/api/upload/health`;
      } else {
        healthUrl = `${server.url}/health`; // 默认
      }

      // 使用 AbortController 实现超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setServerStatus((prev) => ({ ...prev, [server.name]: "online" }));
      } else {
        setServerStatus((prev) => ({ ...prev, [server.name]: "offline" }));
      }
    } catch (error) {
      setServerStatus((prev) => ({ ...prev, [server.name]: "offline" }));
    }
  }, []);

  // 检查所有服务器状态
  const checkAllServers = useCallback(() => {
    servers.forEach(checkServerStatus);
  }, [checkServerStatus]);

  // 初始检查服务器状态
  React.useEffect(() => {
    checkAllServers();
  }, [checkAllServers]);

  // 处理文件选择
  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      const sizeInfo = `${(file.size / 1024 / 1024).toFixed(2)}MB`;
      const chunksInfo = Math.ceil(file.size / (chunkSize * 1024 * 1024));
      message.success(
        `📁 已选择: ${file.name} (${sizeInfo}, ${chunksInfo} 分片)`
      );
      return false; // 阻止自动上传
    },
    [chunkSize]
  );

  // 上传到单个服务器 - 增强的错误处理和进度追踪
  const uploadToServer = async (server: ServerConfig, file: File) => {
    const recordId = `${server.name}-${Date.now()}`;
    const uploadEngine = uploadEnginesRef.current[server.name];

    if (!uploadEngine) {
      message.error(`${server.name} 上传引擎未初始化`);
      return;
    }

    // 创建上传记录
    const record: UploadRecord = {
      id: recordId,
      fileName: file.name,
      fileSize: file.size,
      serverName: server.name,
      status: "pending",
      progress: 0,
      speed: 0,
      elapsedTime: 0,
      startTime: Date.now(),
    };

    setUploadRecords((prev) => [record, ...prev]);
    setActiveUploads((prev) => new Set(prev).add(recordId));

    try {
      // 添加文件到上传引擎
      const fileId = await uploadEngine.addFile(file);

      // 更新状态为上传中
      setUploadRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, status: "uploading" as const } : r
        )
      );

      // 监听进度 - 更详细的进度信息
      const unsubscribeProgress = uploadEngine.on(
        "progress",
        ({
          fileId: uploadFileId,
          progress,
        }: {
          fileId: string;
          progress: UploadProgress;
        }) => {
          if (uploadFileId === fileId) {
            const elapsed = Date.now() - record.startTime;

            setUploadRecords((prev) =>
              prev.map((r) =>
                r.id === recordId
                  ? {
                      ...r,
                      progress: progress.percent,
                      speed: progress.speed,
                      elapsedTime: elapsed,
                    }
                  : r
              )
            );
          }
        }
      );

      // 监听分片完成 - 新增的细粒度事件
      const unsubscribeChunkCompleted = uploadEngine.on(
        "chunkCompleted",
        ({ fileId: uploadFileId, chunkIndex, totalChunks }: any) => {
          if (uploadFileId === fileId) {
            console.log(
              `✅ ${server.name}: 分片 ${chunkIndex + 1}/${totalChunks} 完成`
            );
          }
        }
      );

      // 监听成功
      const unsubscribeSuccess = uploadEngine.on(
        "success",
        ({
          fileId: uploadFileId,
          result,
        }: {
          fileId: string;
          result: UploadResult;
        }) => {
          if (uploadFileId === fileId) {
            const elapsed = Date.now() - record.startTime;

            setUploadRecords((prev) =>
              prev.map((r) =>
                r.id === recordId
                  ? {
                      ...r,
                      status: "success" as const,
                      progress: 100,
                      speed: result.averageSpeed || 0,
                      elapsedTime: elapsed,
                      result,
                    }
                  : r
              )
            );

            setActiveUploads((prev) => {
              const newSet = new Set(prev);
              newSet.delete(recordId);
              return newSet;
            });

            const speedInfo = result.averageSpeed
              ? ` (平均速度: ${(result.averageSpeed / 1024 / 1024).toFixed(
                  2
                )}MB/s)`
              : "";
            message.success(`🎉 ${server.name} 上传成功！${speedInfo}`);

            // 清理事件监听
            unsubscribeProgress();
            unsubscribeSuccess();
            unsubscribeError();
            unsubscribeChunkCompleted();
          }
        }
      );

      // 监听错误 - 增强的错误信息
      const unsubscribeError = uploadEngine.on(
        "error",
        ({
          fileId: uploadFileId,
          error,
        }: {
          fileId: string;
          error: UploadError;
        }) => {
          if (uploadFileId === fileId) {
            setUploadRecords((prev) =>
              prev.map((r) =>
                r.id === recordId
                  ? {
                      ...r,
                      status: "error" as const,
                      error: error.message,
                    }
                  : r
              )
            );

            setActiveUploads((prev) => {
              const newSet = new Set(prev);
              newSet.delete(recordId);
              return newSet;
            });

            const retryInfo = error.retryable ? " (可重试)" : " (不可重试)";
            message.error(
              `❌ ${server.name} 上传失败: ${error.message}${retryInfo}`
            );

            // 清理事件监听
            unsubscribeProgress();
            unsubscribeSuccess();
            unsubscribeError();
            unsubscribeChunkCompleted();
          }
        }
      );

      // 开始上传
      await uploadEngine.startUpload(fileId);
    } catch (error: any) {
      setUploadRecords((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? {
                ...r,
                status: "error" as const,
                error: error.message,
              }
            : r
        )
      );

      setActiveUploads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(recordId);
        return newSet;
      });

      message.error(`💥 ${server.name} 上传异常: ${error.message}`);
    }
  };

  // 上传到指定服务器
  const handleUploadToServer = async (server: ServerConfig) => {
    if (!selectedFile) {
      message.warning("请先选择文件");
      return;
    }

    if (serverStatus[server.name] !== "online") {
      message.warning(`${server.name} 服务器离线`);
      return;
    }

    if (activeUploads.size > 0) {
      message.warning("请等待当前上传完成后再试");
      return;
    }

    setActiveServer(server.name);
    try {
      await uploadToServer(server, selectedFile);
    } finally {
      setActiveServer(null);
    }
  };

  // 顺序上传到所有在线服务器
  const handleUploadToAll = async () => {
    if (!selectedFile) {
      message.warning("请先选择文件");
      return;
    }

    if (activeUploads.size > 0) {
      message.warning("请等待当前上传完成后再试");
      return;
    }

    const onlineServers = servers.filter(
      (server) => serverStatus[server.name] === "online"
    );

    if (onlineServers.length === 0) {
      message.warning("没有在线的服务器");
      return;
    }

    // 顺序上传到每个在线服务器
    for (const server of onlineServers) {
      setActiveServer(server.name);
      try {
        await uploadToServer(server, selectedFile);
        // 等待一秒再上传下一个
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`上传到 ${server.name} 失败:`, error);
        // 继续上传到下一个服务器
      } finally {
        setActiveServer(null);
      }
    }
  };

  // 清空记录
  const clearRecords = () => {
    setUploadRecords([]);
    setActiveUploads(new Set());
  };

  // 渲染服务器状态
  const renderServerStatus = (server: ServerConfig) => {
    const status = serverStatus[server.name];
    const statusConfig = {
      online: { color: "success" as const, text: "在线" },
      offline: { color: "error" as const, text: "离线" },
      checking: { color: "processing" as const, text: "检查中" },
    };

    const config = statusConfig[status] || statusConfig.offline;

    return (
      <Badge
        status={config.color}
        text={
          <Text style={{ color: server.color, fontWeight: 500 }}>
            {config.text}
          </Text>
        }
      />
    );
  };

  // 渲染上传记录
  const renderUploadRecord = (record: UploadRecord) => {
    const server = servers.find((s) => s.name === record.serverName);
    if (!server) return null;

    const statusIcon = {
      pending: <LoadingOutlined style={{ color: "#faad14" }} />,
      uploading: <LoadingOutlined style={{ color: "#1890ff" }} />,
      success: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      error: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
    };

    const statusColor = {
      pending: "warning",
      uploading: "processing",
      success: "success",
      error: "error",
    };

    return (
      <List.Item
        key={record.id}
        actions={[
          record.status === "error" && (
            <Button
              key="retry"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleUploadToServer(server)}
            >
              重试
            </Button>
          ),
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <div style={{ color: server.color, fontSize: 24 }}>
              {server.icon}
            </div>
          }
          title={
            <Space>
              <Text strong>{record.fileName}</Text>
              <Tag color={statusColor[record.status]}>
                {record.status === "pending" && "等待中"}
                {record.status === "uploading" && "上传中"}
                {record.status === "success" && "成功"}
                {record.status === "error" && "失败"}
              </Tag>
              <Text type="secondary">→ {record.serverName}</Text>
            </Space>
          }
          description={
            <div>
              <Space>
                <Text type="secondary">{formatFileSize(record.fileSize)}</Text>
                {record.speed > 0 && (
                  <Text type="secondary">
                    速度: {formatFileSize(record.speed)}/s
                  </Text>
                )}
                {record.elapsedTime > 0 && (
                  <Text type="secondary">
                    用时: {(record.elapsedTime / 1000).toFixed(2)}s
                  </Text>
                )}
              </Space>
              {record.status === "uploading" && (
                <Progress
                  percent={record.progress}
                  size="small"
                  status="active"
                  style={{ marginTop: 8 }}
                />
              )}
              {record.error && (
                <Text type="danger" style={{ display: "block", marginTop: 4 }}>
                  错误: {record.error}
                </Text>
              )}
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <div style={{ padding: "24px", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2} style={{ color: "#1890ff", marginBottom: 8 }}>
            🚀 基于 Uppy 最佳实践的三服务器上传测试
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 16 }}>
            测试 Node.js、Python、Java 三种后端的大文件分片上传性能
          </Paragraph>

          {/* 硬件信息展示 */}
          <Card
            size="small"
            style={{
              maxWidth: 600,
              margin: "16px auto",
              background: "#f0f9ff",
              border: "1px solid #1890ff",
            }}
          >
            <Space size="large">
              <Statistic
                title="🖥️ CPU 核心"
                value={hardwareInfo.cores}
                suffix="核"
                valueStyle={{ color: "#1890ff" }}
              />
              <Statistic
                title="🔄 最优并发"
                value={hardwareInfo.optimalConcurrency}
                suffix="个"
                valueStyle={{ color: "#52c41a" }}
              />
              <Statistic
                title="📦 分片大小"
                value={hardwareInfo.chunkSize}
                suffix="MB"
                valueStyle={{ color: "#fa8c16" }}
              />
            </Space>
          </Card>
        </div>

        {/* 服务器状态 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {servers.map((server) => (
            <Col xs={24} sm={8} key={server.name}>
              <Card
                hoverable
                style={{
                  borderColor: server.color,
                  borderWidth: 2,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 32,
                      color: server.color,
                      marginBottom: 8,
                    }}
                  >
                    {server.icon}
                  </div>
                  <Title level={4} style={{ margin: 0, color: server.color }}>
                    {server.name}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {server.description}
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    {renderServerStatus(server)}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button
                      type={
                        activeServer === server.name ? "default" : "primary"
                      }
                      size="small"
                      style={{
                        backgroundColor:
                          activeServer === server.name
                            ? "#f0f0f0"
                            : server.color,
                        borderColor:
                          activeServer === server.name
                            ? "#d9d9d9"
                            : server.color,
                        color:
                          activeServer === server.name ? "#595959" : "#fff",
                      }}
                      disabled={
                        !selectedFile ||
                        serverStatus[server.name] !== "online" ||
                        (activeUploads.size > 0 && activeServer !== server.name)
                      }
                      loading={activeServer === server.name}
                      onClick={() => handleUploadToServer(server)}
                    >
                      {activeServer === server.name
                        ? "上传中..."
                        : "上传到此服务器"}
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 文件选择区域 */}
        <Card title="选择测试文件" style={{ marginBottom: 24 }}>
          <Dragger
            name="file"
            multiple={false}
            beforeUpload={handleFileSelect}
            showUploadList={false}
            style={{ marginBottom: 16 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域</p>
            <p className="ant-upload-hint">
              支持大文件上传，建议使用较大文件测试性能差异
            </p>
          </Dragger>

          {selectedFile && (
            <Alert
              message={`已选择文件: ${selectedFile.name}`}
              description={`文件大小: ${formatFileSize(selectedFile.size)}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space size="large" wrap>
                <div>
                  <Text style={{ marginRight: 8 }}>📦 分片大小:</Text>
                  <Select
                    value={chunkSize}
                    onChange={(value) => setChunkSize(value)}
                    style={{ width: 120 }}
                    options={[
                      { value: 0.5, label: "0.5MB" },
                      { value: 0.8, label: "0.8MB ⭐" }, // 推荐
                      { value: 1, label: "1MB" },
                      { value: 2, label: "2MB" },
                      { value: 4, label: "4MB" },
                      { value: 8, label: "8MB" },
                      { value: 10, label: "10MB" },
                    ]}
                  />
                  <Text
                    type="secondary"
                    style={{ marginLeft: 8, fontSize: 12 }}
                  >
                    (Uppy 推荐 0.8MB)
                  </Text>
                </div>

                <div>
                  <Text type="secondary">
                    🔄 当前并发: {hardwareInfo.optimalConcurrency}个 | 📊
                    总分片:{" "}
                    {selectedFile
                      ? Math.ceil(selectedFile.size / (chunkSize * 1024 * 1024))
                      : 0}
                    个
                  </Text>
                </div>
              </Space>
            </Col>

            <Col>
              <Space style={{ float: "right" }}>
                <Button
                  onClick={checkAllServers}
                  disabled={activeUploads.size > 0}
                  icon={<ReloadOutlined />}
                >
                  刷新状态
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<CloudServerOutlined />}
                  disabled={!selectedFile || activeUploads.size > 0}
                  onClick={handleUploadToAll}
                >
                  批量上传测试
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 上传记录 */}
        <Card
          title="上传记录"
          extra={
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearRecords}
              disabled={activeUploads.size > 0}
            >
              清空记录
            </Button>
          }
        >
          {uploadRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Text type="secondary">暂无上传记录</Text>
            </div>
          ) : (
            <List
              dataSource={uploadRecords}
              renderItem={renderUploadRecord}
              style={{ maxHeight: 400, overflowY: "auto" }}
            />
          )}
        </Card>

        {/* 性能统计 */}
        {uploadRecords.length > 0 && (
          <Card title="性能对比" style={{ marginTop: 24 }}>
            <Row gutter={16}>
              {servers.map((server) => {
                const serverRecords = uploadRecords.filter(
                  (record) =>
                    record.serverName === server.name &&
                    record.status === "success"
                );

                if (serverRecords.length === 0) return null;

                const avgSpeed =
                  serverRecords.reduce((sum, record) => sum + record.speed, 0) /
                  serverRecords.length;

                const avgTime =
                  serverRecords.reduce(
                    (sum, record) => sum + record.elapsedTime,
                    0
                  ) / serverRecords.length;

                return (
                  <Col xs={24} sm={8} key={server.name}>
                    <Card size="small" style={{ borderColor: server.color }}>
                      <Statistic
                        title={
                          <Space>
                            <span style={{ color: server.color }}>
                              {server.icon}
                            </span>
                            {server.name}
                          </Space>
                        }
                        value={formatFileSize(avgSpeed)}
                        suffix="/s"
                        valueStyle={{ color: server.color }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                          平均用时: {(avgTime / 1000).toFixed(2)}s
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary">
                          成功次数: {serverRecords.length}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
};
