import React, { useState, useRef } from "react";
import {
  Card,
  Button,
  Switch,
  Progress,
  Table,
  Upload,
  Space,
  Typography,
  Divider,
  message,
  List,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  InboxOutlined,
  RocketOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  FileOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import {
  HashWorkerManager,
  SimpleHashCalculator,
  createUploadEngine,
  formatFileSize,
  type HashCalculationResult,
  type SimpleHashResult,
} from "@bigupload/frontend";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface TestResult {
  method: string;
  hash: string;
  elapsedTime: number;
  speed: number;
  workerCount?: number;
  chunkCount?: number;
}

interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  hash: string;
  uploadMode: string;
  status: "uploading" | "success" | "error";
  progress: number;
  elapsedTime?: number;
  speed?: number;
  timestamp: number;
  error?: string;
}

export const PerformanceComparison: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [settings, setSettings] = useState({
    useOptimizedHash: true,
    useChunkedUpload: true,
    workerCount: navigator.hardwareConcurrency || 4,
  });
  const [progress, setProgress] = useState<{ [key: string]: number }>({});

  const hashWorkerManagerRef = useRef<HashWorkerManager | null>(null);
  const uploadEngineRef = useRef<any>(null);

  // 初始化上传引擎
  React.useEffect(() => {
    uploadEngineRef.current = createUploadEngine("http://localhost:3000", {
      debug: true,
      concurrent: 3,
      chunkSize: settings.useChunkedUpload ? 2 * 1024 * 1024 : undefined,
    });

    return () => {
      if (hashWorkerManagerRef.current) {
        hashWorkerManagerRef.current.destroy();
      }
    };
  }, [settings.useChunkedUpload]);

  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    beforeUpload: (file: File) => {
      setFile(file);
      return false; // 阻止自动上传
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      console.log("拖放文件:", e.dataTransfer.files);
    },
  };

  // 计算整体文件Hash（一次性读取）
  const runWholeFileHashTest = async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    setTesting(true);
    setCurrentTest("whole");
    setProgress({ whole: 0 });

    try {
      console.log("🧪 开始测试: 整体文件Hash计算");
      const startTime = Date.now();

      // 更新进度为开始状态
      setProgress({ whole: 5 });

      const wholeResult = await SimpleHashCalculator.calculateFileHashWhole(
        file
      );

      // 更新进度为完成状态
      setProgress({ whole: 100 });

      const newResult = {
        method: "整体文件计算",
        hash: wholeResult.hash.substring(0, 16) + "...",
        elapsedTime: wholeResult.elapsedTime,
        speed: wholeResult.speed,
      };

      // 添加到结果列表
      setTestResults((prev) => {
        // 如果已有相同method的结果，则替换
        const filtered = prev.filter((item) => item.method !== "整体文件计算");
        return [...filtered, newResult];
      });

      message.success("整体文件计算完成");
    } catch (error) {
      message.error("计算失败: " + (error as Error).message);
      console.error("整体Hash计算失败:", error);
    } finally {
      setTesting(false);
      setCurrentTest(null);
    }
  };

  // 单线程分片计算
  const runSingleThreadHashTest = async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    setTesting(true);
    setCurrentTest("singleThread");
    setProgress({ singleThread: 0 });

    try {
      console.log("🧪 开始测试: 单线程分片Hash计算");

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress((prev) => ({
          ...prev,
          singleThread: Math.min((prev.singleThread || 0) + 2, 95),
        }));
      }, 200);

      const singleThreadResult =
        await SimpleHashCalculator.calculateFileHashChunked(file);

      clearInterval(progressInterval);
      setProgress({ singleThread: 100 });

      const newResult = {
        method: "单线程分片计算",
        hash: singleThreadResult.hash.substring(0, 16) + "...",
        elapsedTime: singleThreadResult.elapsedTime,
        speed: singleThreadResult.speed,
      };

      setTestResults((prev) => {
        const filtered = prev.filter(
          (item) => item.method !== "单线程分片计算"
        );
        return [...filtered, newResult];
      });

      message.success("单线程分片计算完成");
    } catch (error) {
      message.error("计算失败: " + (error as Error).message);
      console.error("单线程Hash计算失败:", error);
    } finally {
      setTesting(false);
      setCurrentTest(null);
    }
  };

  // 多线程分片计算
  const runMultiThreadHashTest = async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    setTesting(true);
    setCurrentTest("multiThread");

    try {
      console.log("🧪 开始测试: 多线程分片Hash计算");

      // 创建或重置 HashWorkerManager
      if (hashWorkerManagerRef.current) {
        hashWorkerManagerRef.current.destroy();
      }

      hashWorkerManagerRef.current = new HashWorkerManager(
        settings.workerCount,
        (progress) => {
          setProgress((prev) => ({
            ...prev,
            multiThread: progress.progress,
          }));
        }
      );

      const testId = `test-${Date.now()}`;
      const multiThreadResult =
        await hashWorkerManagerRef.current.calculateFileHash(file, testId);

      const newResult = {
        method: `多线程计算 (${multiThreadResult.workerCount}个Worker)`,
        hash: multiThreadResult.hash.substring(0, 16) + "...",
        elapsedTime: multiThreadResult.elapsedTime,
        speed: multiThreadResult.speed,
        workerCount: multiThreadResult.workerCount,
        chunkCount: multiThreadResult.chunkCount,
      };

      setTestResults((prev) => {
        const filtered = prev.filter(
          (item) => !item.method.startsWith("多线程计算")
        );
        return [...filtered, newResult];
      });

      message.success("多线程分片计算完成");
    } catch (error) {
      message.error("计算失败: " + (error as Error).message);
      console.error("多线程Hash计算失败:", error);
    } finally {
      setTesting(false);
      setCurrentTest(null);
    }
  };

  // 根据选项计算文件Hash
  const calculateHashByOption = async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    setTesting(true);
    setCurrentTest("auto");

    try {
      let hash: string;
      let startTime = Date.now();

      if (settings.useOptimizedHash) {
        // 使用优化的多线程计算
        if (hashWorkerManagerRef.current) {
          hashWorkerManagerRef.current.destroy();
        }

        hashWorkerManagerRef.current = new HashWorkerManager(
          settings.workerCount,
          (progress) => {
            setProgress((prev) => ({
              ...prev,
              auto: progress.progress,
            }));
          }
        );

        const testId = `file-${Date.now()}`;
        const result = await hashWorkerManagerRef.current.calculateFileHash(
          file,
          testId
        );
        hash = result.hash;
      } else {
        // 使用单线程计算
        const progressInterval = setInterval(() => {
          setProgress((prev) => ({
            ...prev,
            auto: Math.min((prev.auto || 0) + 2, 95),
          }));
        }, 200);

        const result = await SimpleHashCalculator.calculateFileHashChunked(
          file
        );
        hash = result.hash;

        clearInterval(progressInterval);
        setProgress({ auto: 100 });
      }

      const elapsedTime = Date.now() - startTime;
      return {
        hash,
        elapsedTime,
      };
    } catch (error) {
      message.error("Hash计算失败: " + (error as Error).message);
      console.error("Hash计算失败:", error);
      throw error;
    } finally {
      setTesting(false);
      setCurrentTest(null);
    }
  };

  // 执行上传测试
  const runUploadTest = async () => {
    if (!file || !uploadEngineRef.current) {
      message.warning("请先选择文件");
      return;
    }

    setTesting(true);

    const recordId = `upload-${Date.now()}`;

    // 添加上传记录
    const newRecord: UploadRecord = {
      id: recordId,
      fileName: file.name,
      fileSize: file.size,
      hash: "",
      uploadMode: settings.useChunkedUpload ? "分片上传" : "整体上传",
      status: "uploading",
      progress: 0,
      timestamp: Date.now(),
    };

    setUploadRecords((prev) => [newRecord, ...prev]);

    try {
      // 先计算文件Hash
      setCurrentTest("hashBeforeUpload");
      const hashResult = await calculateHashByOption();

      // 添加文件到上传引擎
      const fileId = await uploadEngineRef.current.addFile(file, {
        hash: hashResult.hash,
      });

      // 更新上传记录
      setUploadRecords((prev) =>
        prev.map((record) =>
          record.id === recordId
            ? {
                ...record,
                hash: hashResult.hash.substring(0, 16) + "...",
                status: "uploading",
                progress: 0,
              }
            : record
        )
      );

      const startTime = Date.now();

      // 监听上传进度
      uploadEngineRef.current.on("progress", (data: any) => {
        if (data.fileId === fileId) {
          const elapsed = Date.now() - startTime;
          const bytesUploaded = (data.progress.percent / 100) * file.size;
          const speed =
            elapsed > 0 ? Math.round((bytesUploaded / elapsed) * 1000) : 0;

          setUploadRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    progress: data.progress.percent,
                    elapsedTime: elapsed,
                    speed,
                  }
                : record
            )
          );
        }
      });

      // 监听上传完成
      uploadEngineRef.current.on("success", (data: any) => {
        if (data.fileId === fileId) {
          const elapsed = Date.now() - startTime;
          const speed =
            elapsed > 0 ? Math.round((file.size / elapsed) * 1000) : 0;

          setUploadRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    status: "success",
                    progress: 100,
                    elapsedTime: elapsed,
                    speed,
                  }
                : record
            )
          );

          message.success(`文件 ${file.name} 上传成功！`);
        }
      });

      // 监听上传错误
      uploadEngineRef.current.on("error", (data: any) => {
        if (data.fileId === fileId) {
          setUploadRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    status: "error",
                    error: data.error?.message || "未知错误",
                  }
                : record
            )
          );

          message.error(`上传失败: ${data.error?.message || "未知错误"}`);
        }
      });

      // 开始上传
      await uploadEngineRef.current.startUpload(fileId);
    } catch (error) {
      console.error("上传测试失败:", error);

      setUploadRecords((prev) =>
        prev.map((record) =>
          record.id === recordId
            ? {
                ...record,
                status: "error",
                error: (error as Error).message,
              }
            : record
        )
      );

      message.error("上传失败: " + (error as Error).message);
    } finally {
      setTesting(false);
      setCurrentTest(null);
    }
  };

  const columns = [
    {
      title: "计算方法",
      dataIndex: "method",
      key: "method",
      width: 180,
    },
    {
      title: "Hash值 (前16位)",
      dataIndex: "hash",
      key: "hash",
      width: 150,
      render: (hash: string) => <Text copyable>{hash}</Text>,
    },
    {
      title: "耗时 (毫秒)",
      dataIndex: "elapsedTime",
      key: "elapsedTime",
      width: 120,
      render: (time: number) => (
        <Text type="secondary">{time.toLocaleString()}</Text>
      ),
      sorter: (a: TestResult, b: TestResult) => a.elapsedTime - b.elapsedTime,
    },
    {
      title: "速度 (MB/s)",
      dataIndex: "speed",
      key: "speed",
      width: 120,
      render: (speed: number) => (
        <Text type="success">{(speed / (1024 * 1024)).toFixed(2)}</Text>
      ),
      sorter: (a: TestResult, b: TestResult) => b.speed - a.speed,
    },
    {
      title: "Worker数量",
      dataIndex: "workerCount",
      key: "workerCount",
      width: 100,
      render: (count?: number) => (count ? <Text>{count}</Text> : "-"),
    },
    {
      title: "分片数",
      dataIndex: "chunkCount",
      key: "chunkCount",
      width: 100,
      render: (count?: number) => (count ? <Text>{count}</Text> : "-"),
    },
  ];

  // 计算性能提升
  const getPerformanceImprovement = () => {
    const singleThreadResult = testResults.find(
      (item) => item.method === "单线程分片计算"
    );
    const multiThreadResult = testResults.find((item) =>
      item.method.startsWith("多线程计算")
    );

    if (!singleThreadResult || !multiThreadResult) return null;

    const singleThreadTime = singleThreadResult.elapsedTime;
    const multiThreadTime = multiThreadResult.elapsedTime;

    const improvement = (
      ((singleThreadTime - multiThreadTime) / singleThreadTime) *
      100
    ).toFixed(1);
    const speedup = (singleThreadTime / multiThreadTime).toFixed(1);

    return { improvement, speedup };
  };

  const performance = getPerformanceImprovement();

  // 上传记录列表项渲染
  const renderUploadItem = (item: UploadRecord) => {
    const titleStyle = { margin: 0 };
    const tagStyle = { marginLeft: 8 };

    const statusTag = () => {
      switch (item.status) {
        case "uploading":
          return (
            <Tag color="processing" style={tagStyle}>
              上传中
            </Tag>
          );
        case "success":
          return (
            <Tag
              color="success"
              style={tagStyle}
              icon={<CheckCircleOutlined />}
            >
              上传成功
            </Tag>
          );
        case "error":
          return (
            <Tag color="error" style={tagStyle} icon={<CloseCircleOutlined />}>
              上传失败
            </Tag>
          );
        default:
          return null;
      }
    };

    const title = (
      <div style={{ display: "flex", alignItems: "center" }}>
        <FileOutlined style={{ marginRight: 8 }} />
        <Text strong style={titleStyle}>
          {item.fileName}
        </Text>
        {statusTag()}
        <Tag color="blue" style={tagStyle}>
          {item.uploadMode}
        </Tag>
      </div>
    );

    const description = (
      <>
        <div>
          <Text type="secondary">
            文件大小: {formatFileSize(item.fileSize)}
          </Text>
          {item.hash && (
            <Text type="secondary" style={{ marginLeft: 16 }}>
              Hash: {item.hash}
            </Text>
          )}
        </div>
        {(item.status === "uploading" || item.status === "success") && (
          <Progress
            percent={item.progress}
            status={item.status === "uploading" ? "active" : "success"}
            size="small"
            style={{ marginTop: 8, marginBottom: 8 }}
          />
        )}
        <div>
          {item.status === "error" && (
            <Text type="danger">错误: {item.error}</Text>
          )}
          {item.elapsedTime && item.elapsedTime > 0 && (
            <Text type="secondary">
              耗时: {(item.elapsedTime / 1000).toFixed(2)}秒
            </Text>
          )}
          {item.speed && item.speed > 0 && (
            <Text type="secondary" style={{ marginLeft: 16 }}>
              速度: {(item.speed / (1024 * 1024)).toFixed(2)} MB/s
            </Text>
          )}
        </div>
      </>
    );

    return (
      <List.Item>
        <List.Item.Meta title={title} description={description} />
      </List.Item>
    );
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <Title level={2}>
        <RocketOutlined /> 大文件上传性能对比测试
      </Title>

      <Card title="📁 文件选择" style={{ marginBottom: "24px" }}>
        <Dragger {...uploadProps} style={{ marginBottom: "16px" }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持大文件上传，建议选择较大的文件来测试性能差异
          </p>
        </Dragger>

        {file && (
          <div>
            <Text strong>已选择文件:</Text> {file.name} (
            {formatFileSize(file.size)})
          </div>
        )}
      </Card>

      <Card title="⚙️ 测试设置" style={{ marginBottom: "24px" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text>多线程Worker数量: </Text>
            <Text strong>{settings.workerCount}</Text>
            <Text type="secondary">
              {" "}
              (检测到CPU核心数: {navigator.hardwareConcurrency})
            </Text>
          </div>

          <div>
            <Switch
              checked={settings.useOptimizedHash}
              onChange={(checked) =>
                setSettings((prev) => ({ ...prev, useOptimizedHash: checked }))
              }
            />
            <Text style={{ marginLeft: "8px" }}>
              使用优化的Hash计算 (多线程)
            </Text>
          </div>

          <div>
            <Switch
              checked={settings.useChunkedUpload}
              onChange={(checked) =>
                setSettings((prev) => ({ ...prev, useChunkedUpload: checked }))
              }
            />
            <Text style={{ marginLeft: "8px" }}>使用分片上传</Text>
          </div>
        </Space>
      </Card>

      <Card title="🧪 Hash计算性能测试" style={{ marginBottom: "24px" }}>
        <Paragraph>
          点击下面按钮分别测试三种不同的Hash计算方法，观察性能差异：
        </Paragraph>

        <Row gutter={16} style={{ marginBottom: "16px" }}>
          <Col xs={24} sm={8}>
            <Card size="small" title="整体文件计算" className="test-card">
              <Paragraph type="secondary">
                一次性读取整个文件计算Hash，内存占用大
              </Paragraph>
              <Button
                type="primary"
                onClick={runWholeFileHashTest}
                disabled={!file || testing}
                loading={currentTest === "whole"}
                block
              >
                {currentTest === "whole" ? "计算中..." : "开始计算"}
              </Button>
              {progress.whole !== undefined && (
                <Progress
                  percent={progress.whole}
                  size="small"
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card size="small" title="单线程分片计算" className="test-card">
              <Paragraph type="secondary">
                分片读取文件串行计算Hash，内存友好但速度慢
              </Paragraph>
              <Button
                type="primary"
                onClick={runSingleThreadHashTest}
                disabled={!file || testing}
                loading={currentTest === "singleThread"}
                block
              >
                {currentTest === "singleThread" ? "计算中..." : "开始计算"}
              </Button>
              {progress.singleThread !== undefined && (
                <Progress
                  percent={progress.singleThread}
                  size="small"
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card size="small" title="多线程分片计算" className="test-card">
              <Paragraph type="secondary">
                Web Worker并行计算各分片Hash，速度快且内存友好
              </Paragraph>
              <Button
                type="primary"
                onClick={runMultiThreadHashTest}
                disabled={!file || testing}
                loading={currentTest === "multiThread"}
                block
              >
                {currentTest === "multiThread" ? "计算中..." : "开始计算"}
              </Button>
              {progress.multiThread !== undefined && (
                <Progress
                  percent={progress.multiThread}
                  size="small"
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>
        </Row>

        {testResults.length > 0 && (
          <>
            <Table
              dataSource={testResults.map((result, index) => ({
                ...result,
                key: index,
              }))}
              columns={columns}
              pagination={false}
              size="small"
              style={{ marginBottom: "16px" }}
            />

            {performance && (
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f6ffed",
                  border: "1px solid #b7eb8f",
                  borderRadius: "6px",
                }}
              >
                <Text strong style={{ color: "#52c41a" }}>
                  🚀 性能提升: 多线程比单线程快 {performance.improvement}%
                  (加速比: {performance.speedup}x)
                </Text>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="📤 上传测试" style={{ marginBottom: "24px" }}>
        <Space
          style={{ marginBottom: "16px" }}
          direction="vertical"
          size="middle"
        >
          <Paragraph>
            使用
            <Tag color={settings.useChunkedUpload ? "green" : "orange"}>
              {settings.useChunkedUpload ? "分片上传" : "整体上传"}
            </Tag>
            模式，
            {settings.useOptimizedHash ? "开启" : "关闭"}多线程Hash计算优化
          </Paragraph>

          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={runUploadTest}
            disabled={!file || testing}
            loading={testing && currentTest?.includes("upload")}
          >
            开始上传测试
          </Button>

          {uploadRecords.length > 0 && (
            <Statistic
              title="已完成上传测试次数"
              value={uploadRecords.length}
              suffix="次"
            />
          )}
        </Space>

        {uploadRecords.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <Title level={5}>上传记录</Title>
            <List
              itemLayout="vertical"
              dataSource={uploadRecords}
              renderItem={renderUploadItem}
              bordered
            />
          </div>
        )}
      </Card>

      <Divider />

      <Card title="📊 性能对比说明" size="small">
        <Space direction="vertical">
          <Text>
            • <strong>整体文件计算</strong>:
            一次性读取整个文件计算Hash，内存占用大
          </Text>
          <Text>
            • <strong>单线程分片计算</strong>:
            分片读取文件串行计算Hash，内存友好但速度慢
          </Text>
          <Text>
            • <strong>多线程分片计算</strong>: 使用Web
            Worker并行计算各分片Hash，速度快且内存友好
          </Text>
          <Text>
            • <strong>分片上传</strong>:
            将大文件分成小块上传，支持断点续传和并发上传
          </Text>
          <Text>
            • <strong>整体上传</strong>:
            一次性上传整个文件，简单但不支持断点续传
          </Text>
        </Space>
      </Card>
    </div>
  );
};
