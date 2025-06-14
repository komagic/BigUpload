import React, { useState, useRef } from "react";
import {
  Card,
  Space,
  Typography,
  Divider,
  Alert,
  Progress,
  Button,
  Tag,
  Table,
  message,
  Row,
  Col,
  Upload,
} from "antd";
import {
  BigAntUploader,
  PREDEFINED_TYPES,
  type BigAntUploaderRef,
} from "@bigupload/react";
import {
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  FileOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import SparkMD5 from "spark-md5";

const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

const API_BASE_URL = "http://localhost:3000";

interface UploadRecord {
  fileId: string;
  fileName: string;
  fileSize: number;
  originalHash: string; // 原始文件Hash
  serverHash?: string; // 服务器返回的Hash
  status: string;
  progress: number;
  uploadTime: Date;
  downloadUrl?: string;
  error?: string;
  hashMatches?: boolean; // Hash是否匹配
  file?: File; // 保存文件对象以便后续上传
}

const App: React.FC = () => {
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [isCalculatingHash, setIsCalculatingHash] = useState<
    Record<string, boolean>
  >({});
  const uploaderRef = useRef<BigAntUploaderRef>(null);

  // 计算文件Hash
  const calculateFileHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      const chunkSize = 2 * 1024 * 1024; // 2MB
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
  };

  // 处理文件拖拽上传
  const handleFileUpload = async (fileList: File[]) => {
    console.log("📁 开始处理文件:", fileList);

    for (const file of fileList) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`🔢 开始计算文件Hash: ${file.name}`);

      // 创建初始记录
      const newRecord: UploadRecord = {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        originalHash: "",
        status: "hashing",
        progress: 0,
        uploadTime: new Date(),
        file: file, // 保存文件对象
      };

      setUploadRecords((prev) => [...prev, newRecord]);
      setIsCalculatingHash((prev) => ({ ...prev, [fileId]: true }));

      try {
        // 计算文件Hash
        const fileHash = await calculateFileHash(file);
        console.log(`✅ 文件Hash计算完成: ${fileHash}`);

        // 更新记录
        setUploadRecords((prev) =>
          prev.map((record) =>
            record.fileId === fileId
              ? { ...record, originalHash: fileHash, status: "pending" }
              : record
          )
        );
        setIsCalculatingHash((prev) => ({ ...prev, [fileId]: false }));

        message.success(`文件 ${file.name} Hash计算完成，可以开始上传！`);
      } catch (error) {
        console.error("❌ Hash计算失败:", error);
        setUploadRecords((prev) =>
          prev.map((record) =>
            record.fileId === fileId
              ? { ...record, status: "error", error: "Hash计算失败" }
              : record
          )
        );
        setIsCalculatingHash((prev) => ({ ...prev, [fileId]: false }));
        message.error(`文件 ${file.name} Hash计算失败`);
      }
    }
  };

  // 处理上传进度
  const handleProgress = (fileId: string, progress: any) => {
    console.log("📊 上传进度:", fileId, progress);

    setUploadRecords((prev) =>
      prev.map((record) =>
        record.fileId === fileId
          ? { ...record, progress: progress.percent, status: "uploading" }
          : record
      )
    );
  };

  // 处理上传成功
  const handleSuccess = (fileId: string, result: any) => {
    console.log("✅ 上传成功:", fileId, result);

    setUploadRecords((prev) =>
      prev.map((record) => {
        if (record.fileId === fileId) {
          const serverHash = result.fileHash || record.originalHash;
          const hashMatches = serverHash === record.originalHash;

          if (hashMatches) {
            message.success(`文件上传成功！Hash验证通过 ✓`);
          } else {
            message.warning(
              `文件上传成功，但Hash不匹配！原始: ${record.originalHash.slice(
                0,
                16
              )}... 服务器: ${serverHash.slice(0, 16)}...`
            );
          }

          return {
            ...record,
            status: "completed",
            progress: 100,
            downloadUrl: result.url,
            serverHash,
            hashMatches,
          };
        }
        return record;
      })
    );
  };

  // 处理上传错误
  const handleError = (fileId: string, error: any) => {
    console.error("❌ 上传错误:", fileId, error);
    message.error(`上传失败: ${error.message}`);

    setUploadRecords((prev) =>
      prev.map((record) =>
        record.fileId === fileId
          ? {
              ...record,
              status: "error",
              error: error.message,
            }
          : record
      )
    );
  };

  // 处理文件下载
  const handleDownload = (record: UploadRecord) => {
    if (record.downloadUrl) {
      const link = document.createElement("a");
      link.href = `${API_BASE_URL}${record.downloadUrl}`;
      link.download = record.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`开始下载文件: ${record.fileName}`);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 自定义拖拽上传
  const customUpload = ({ file }: any) => {
    handleFileUpload([file]);
    return false; // 阻止默认上传
  };

  // 渲染状态标签
  const renderStatus = (status: string, hashMatches?: boolean) => {
    const statusConfig = {
      pending: { color: "default", text: "等待上传" },
      hashing: { color: "processing", text: "计算Hash" },
      verifying: { color: "processing", text: "验证文件" },
      uploading: { color: "processing", text: "上传中" },
      merging: { color: "processing", text: "合并分片" },
      completed: {
        color: hashMatches ? "success" : "warning",
        text: hashMatches ? "完成(Hash✓)" : "完成(Hash?)",
      },
      error: { color: "error", text: "失败" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Tag
        color={config.color}
        icon={
          config.color === "success" ? (
            <CheckCircleOutlined />
          ) : config.color === "error" ? (
            <CloseCircleOutlined />
          ) : config.color === "warning" ? (
            <InfoCircleOutlined />
          ) : undefined
        }
      >
        {config.text}
      </Tag>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: "文件名",
      dataIndex: "fileName",
      key: "fileName",
      ellipsis: true,
      render: (fileName: string, record: UploadRecord) => (
        <Space>
          <FileOutlined />
          <Text>{fileName}</Text>
          {isCalculatingHash[record.fileId] && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              (计算Hash中...)
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "文件大小",
      dataIndex: "fileSize",
      key: "fileSize",
      render: (size: number) => formatFileSize(size),
      width: 120,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string, record: UploadRecord) =>
        renderStatus(status, record.hashMatches),
      width: 140,
    },
    {
      title: "进度",
      dataIndex: "progress",
      key: "progress",
      render: (progress: number, record: UploadRecord) => (
        <Progress
          percent={progress}
          size="small"
          status={record.status === "error" ? "exception" : undefined}
          showInfo={progress > 0}
        />
      ),
      width: 150,
    },
    {
      title: "MD5 Hash",
      key: "hash",
      render: (_: any, record: UploadRecord) => (
        <Space direction="vertical" size="small">
          {record.originalHash && (
            <div>
              <Text strong style={{ fontSize: "11px" }}>
                原始:
              </Text>
              <br />
              <Text code style={{ fontSize: "10px" }}>
                {record.originalHash.substring(0, 16)}...
              </Text>
            </div>
          )}
          {record.serverHash && (
            <div>
              <Text strong style={{ fontSize: "11px" }}>
                服务器:
              </Text>
              <br />
              <Text code style={{ fontSize: "10px" }}>
                {record.serverHash.substring(0, 16)}...
              </Text>
              {record.hashMatches !== undefined && (
                <Tag
                  color={record.hashMatches ? "green" : "red"}
                  style={{ marginLeft: 4 }}
                >
                  {record.hashMatches ? "✓" : "✗"}
                </Tag>
              )}
            </div>
          )}
        </Space>
      ),
      width: 160,
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: UploadRecord) => (
        <Space size="small" direction="vertical">
          {record.status === "pending" && record.originalHash && (
            <Button
              type="primary"
              size="small"
              onClick={async () => {
                try {
                  // 从记录中找到对应的文件
                  const fileRecord = uploadRecords.find(
                    (r) => r.fileId === record.fileId
                  );
                  if (!fileRecord || !fileRecord.file) {
                    message.error("找不到文件对象，请重新拖拽文件");
                    return;
                  }

                  // 使用 BigAntUploader 的 addFiles 方法添加文件
                  if (uploaderRef.current) {
                    await uploaderRef.current.addFiles([fileRecord.file]);
                    message.success("文件已添加到上传队列，将自动开始上传");
                  } else {
                    message.error("上传组件未就绪");
                  }
                } catch (error: any) {
                  message.error(`上传失败: ${error.message}`);
                }
              }}
            >
              开始上传
            </Button>
          )}
          {record.downloadUrl && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载验证
            </Button>
          )}
        </Space>
      ),
      width: 100,
    },
  ];

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1400,
        margin: "0 auto",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Title level={2} style={{ margin: 0 }}>
            🚀 BigUpload 大文件上传与MD5验证
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            专业的企业级大文件上传解决方案，支持任意格式文件拖拽上传、MD5完整性验证、下载对比
          </Paragraph>
        </Space>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="📁 文件预处理区" size="small">
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Alert
                message="任意格式文件拖拽上传"
                description="支持所有文件格式，拖拽后自动计算MD5，准备上传"
                type="info"
                showIcon
              />

              <Dragger
                customRequest={customUpload}
                multiple={true}
                showUploadList={false}
                style={{ padding: "20px" }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined
                    style={{ fontSize: "48px", color: "#1890ff" }}
                  />
                </p>
                <p className="ant-upload-text">
                  点击或拖拽任意格式文件到此区域
                </p>
                <p className="ant-upload-hint">
                  支持单个或批量上传。自动计算MD5，确保文件完整性
                </p>
              </Dragger>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="🔧 实际上传区" size="small">
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Alert
                message="分片上传引擎"
                description="使用此组件进行实际的分片上传、断点续传操作"
                type="success"
                showIcon
              />

              <BigAntUploader
                ref={uploaderRef}
                baseUrl={API_BASE_URL}
                maxFileSize={2 * 1024 * 1024 * 1024} // 2GB
                chunkSize={5 * 1024 * 1024} // 5MB，大文件使用更大的分片
                concurrent={1} // 大文件使用单线程上传，避免服务器压力
                retryCount={10} // 大幅增加重试次数
                retryDelay={3000} // 增加重试延迟到3秒
                accept={[PREDEFINED_TYPES.ALL]}
                title="分片上传"
                description="支持大文件分片上传、断点续传、秒传、自动恢复"
                showDragger={true}
                debug={true}
                showFileList={true}
                showTotalProgress={true}
                onProgress={handleProgress}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="📊 上传记录与MD5验证"
        size="small"
        style={{ marginTop: 24 }}
        extra={
          <Space>
            <Text type="secondary">总计: {uploadRecords.length} 个文件</Text>
            <Button
              size="small"
              onClick={() => setUploadRecords([])}
              disabled={uploadRecords.length === 0}
            >
              清空记录
            </Button>
          </Space>
        }
      >
        {uploadRecords.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
            <Typography.Title level={4} type="secondary">
              暂无上传记录
            </Typography.Title>
            <Typography.Text type="secondary">
              请拖拽文件到上方区域开始处理
            </Typography.Text>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={uploadRecords}
            rowKey="fileId"
            size="small"
            pagination={false}
            scroll={{ x: 1000 }}
          />
        )}
      </Card>

      <Card style={{ marginTop: 24 }} size="small">
        <Title level={4}>🔍 验证说明</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small" type="inner">
              <Text strong>MD5计算</Text>
              <br />
              <Text type="secondary">上传前客户端计算</Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" type="inner">
              <Text strong>服务器验证</Text>
              <br />
              <Text type="secondary">合并后重新计算MD5</Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" type="inner">
              <Text strong>完整性检查</Text>
              <br />
              <Text type="secondary">下载文件验证一致性</Text>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Alert
          message="如何验证文件完整性"
          description={
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>拖拽文件到预处理区，系统自动计算原始MD5</li>
              <li>使用右侧上传组件进行实际上传操作</li>
              <li>上传完成后，服务器返回合并文件的MD5</li>
              <li>系统自动对比两个MD5值，显示验证结果</li>
              <li>点击"下载验证"按钮，重新下载文件进行本地验证</li>
            </ol>
          }
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};

export default App;
