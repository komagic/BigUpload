/**
 * BigUpload 演示页面
 * 展示UI和逻辑分离的上传组件使用方法
 */

import React, { useState } from "react";
import { Tabs, Card, Typography, Space, Alert, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

import { BigUploader } from "../components/BigUploader";
import { BigAntUploader } from "../components/BigAntUploader";
import { BigUploadEngine, createUploadEngine } from "../index";

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

const API_BASE_URL = "http://localhost:3000";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Title level={1}>BigUpload 大文件上传组件</Title>
          <Paragraph>
            基于统一架构的大文件上传解决方案，支持分片上传、断点续传、秒传功能。
            <br />
            UI与逻辑完全分离，支持多种前端框架集成。
          </Paragraph>
        </div>

        <Alert
          message="架构特点"
          description={
            <ul style={{ marginBottom: 0 }}>
              <li>
                <strong>核心引擎</strong>：纯TypeScript实现，不依赖任何UI框架
              </li>
              <li>
                <strong>React Hook</strong>：提供useBigUpload
                Hook，方便React项目集成
              </li>
              <li>
                <strong>多UI组件</strong>：提供基础组件和Ant Design组件
              </li>
              <li>
                <strong>统一API</strong>
                ：所有后端（Java/Python/Node.js）使用相同的接口
              </li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: "24px" }}
        />

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基础组件" key="basic">
            <Card
              title="BigUploader - 基础上传组件"
              style={{ marginBottom: "16px" }}
            >
              <Paragraph>
                基于原生CSS样式的上传组件，可自定义样式，适合需要完全控制UI的场景。
              </Paragraph>

              <BigUploader
                baseUrl={API_BASE_URL}
                maxFiles={5}
                maxFileSize={100 * 1024 * 1024} // 100MB
                accept={[".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"]}
                autoStart={true}
                chunkSize={2 * 1024 * 1024} // 2MB
                concurrent={3}
                debug={true}
                onSuccess={(fileId, result) => {
                  console.log("上传成功:", fileId, result);
                }}
                onError={(fileId, error) => {
                  console.error("上传失败:", fileId, error);
                }}
                onProgress={(fileId, progress) => {
                  console.log("上传进度:", fileId, progress);
                }}
              />
            </Card>
          </TabPane>

          <TabPane tab="Ant Design组件" key="antd">
            <Card
              title="BigAntUploader - Ant Design样式组件"
              style={{ marginBottom: "16px" }}
            >
              <Paragraph>
                基于Ant Design设计系统的上传组件，界面美观，交互完善。
              </Paragraph>

              <BigAntUploader
                baseUrl={API_BASE_URL}
                title="Ant Design 大文件上传"
                description="支持拖拽上传，支持大文件分片上传、断点续传、秒传"
                maxFiles={10}
                maxFileSize={500 * 1024 * 1024} // 500MB
                accept={["image/*", ".pdf", ".doc", ".docx", ".xls", ".xlsx"]}
                autoStart={true}
                chunkSize={5 * 1024 * 1024} // 5MB
                concurrent={4}
                showDragger={true}
                showFileList={true}
                showTotalProgress={true}
                listHeight={300}
                onSuccess={(fileId, result) => {
                  console.log("Ant组件上传成功:", fileId, result);
                }}
                onError={(fileId, error) => {
                  console.error("Ant组件上传失败:", fileId, error);
                }}
                onProgress={(fileId, progress) => {
                  console.log("Ant组件上传进度:", fileId, progress);
                }}
              />
            </Card>
          </TabPane>

          <TabPane tab="核心引擎示例" key="engine">
            <Card title="直接使用核心引擎" style={{ marginBottom: "16px" }}>
              <Paragraph>
                展示如何直接使用BigUploadEngine核心引擎，适合需要完全自定义UI的场景。
              </Paragraph>

              <EngineDemo />
            </Card>
          </TabPane>

          <TabPane tab="代码示例" key="code">
            <Card title="使用示例">
              <Title level={4}>1. 安装依赖</Title>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                }}
              >
                {`npm install @bigupload/react
# 或
yarn add @bigupload/react`}
              </pre>

              <Title level={4}>2. 基础使用</Title>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                }}
              >
                {`import { BigUploader } from '@bigupload/react';

function App() {
  return (
    <BigUploader
      baseUrl="http://localhost:3000"
      maxFiles={5}
      maxFileSize={100 * 1024 * 1024}
      accept={['.jpg', '.png', '.pdf']}
      onSuccess={(fileId, result) => {
        console.log('上传成功:', result);
      }}
    />
  );
}`}
              </pre>

              <Title level={4}>3. 使用Ant Design组件</Title>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                }}
              >
                {`import { BigAntUploader } from '@bigupload/react';

function App() {
  return (
    <BigAntUploader
      baseUrl="http://localhost:3000"
      title="文件上传"
      showDragger={true}
      maxFiles={10}
    />
  );
}`}
              </pre>

              <Title level={4}>4. 使用Hook</Title>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                }}
              >
                {`import { useBigUpload } from '@bigupload/react';

function CustomUploader() {
  const {
    files,
    addFiles,
    startUpload,
    isUploading,
    totalProgress
  } = useBigUpload({
    baseUrl: 'http://localhost:3000',
    autoStart: true
  });

  return (
    <div>
      <input 
        type="file" 
        multiple 
        onChange={(e) => addFiles(e.target.files)}
      />
      <div>进度: {totalProgress.percent}%</div>
      {files.map(file => (
        <div key={file.fileId}>
          {file.file.name} - {file.status}
        </div>
      ))}
    </div>
  );
}`}
              </pre>

              <Title level={4}>5. 直接使用核心引擎</Title>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                }}
              >
                {`import { BigUploadEngine } from '@bigupload/react';

const engine = new BigUploadEngine({
  baseUrl: 'http://localhost:3000',
  chunkSize: 2 * 1024 * 1024,
  concurrent: 3
});

// 监听事件
engine.on('progress', ({ fileId, progress }) => {
  console.log('上传进度:', progress.percent);
});

engine.on('success', ({ fileId, result }) => {
  console.log('上传成功:', result);
});

// 添加文件并开始上传
const fileId = await engine.addFile(file);
await engine.startUpload(fileId);`}
              </pre>
            </Card>
          </TabPane>
        </Tabs>
      </div>
    </ConfigProvider>
  );
};

// 核心引擎示例组件
const EngineDemo: React.FC = () => {
  const [engine] = useState(() =>
    createUploadEngine(API_BASE_URL, { debug: true })
  );
  const [files, setFiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  React.useEffect(() => {
    const addLog = (message: string) => {
      setLogs((prev) => [
        ...prev.slice(-9),
        `${new Date().toLocaleTimeString()}: ${message}`,
      ]);
    };

    const unsubscribes = [
      engine.on("stateChange", ({ fileId, state }) => {
        setFiles((prev) => {
          const index = prev.findIndex((f) => f.fileId === fileId);
          if (index >= 0) {
            const newFiles = [...prev];
            newFiles[index] = state;
            return newFiles;
          } else {
            return [...prev, state];
          }
        });
        addLog(`文件 ${state.file.name} 状态变化: ${state.status}`);
      }),

      engine.on("progress", ({ fileId, progress }) => {
        addLog(`文件上传进度: ${progress.percent}%`);
      }),

      engine.on("success", ({ fileId, result }) => {
        addLog(`文件上传成功: ${result.message}`);
      }),

      engine.on("error", ({ fileId, error }) => {
        addLog(`文件上传失败: ${error.message}`);
      }),
    ];

    return () => {
      unsubscribes.forEach((fn) => fn());
    };
  }, [engine]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const fileId = await engine.addFile(file);
        engine.startUpload(fileId);
      } catch (error) {
        console.error("添加文件失败:", error);
      }
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <div>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ marginBottom: "16px" }}
        />
      </div>

      {files.length > 0 && (
        <Card size="small" title="文件列表">
          {files.map((file) => (
            <div
              key={file.fileId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <span>{file.file.name}</span>
              <Space>
                <Text type="secondary">{file.status}</Text>
                {file.progress && <Text>{file.progress.percent}%</Text>}
                <Space size="small">
                  <button
                    onClick={() => engine.pauseUpload(file.fileId)}
                    disabled={file.status !== "uploading"}
                  >
                    暂停
                  </button>
                  <button
                    onClick={() => engine.resumeUpload(file.fileId)}
                    disabled={file.status !== "paused"}
                  >
                    继续
                  </button>
                  <button
                    onClick={() => engine.removeFile(file.fileId)}
                    style={{ color: "red" }}
                  >
                    删除
                  </button>
                </Space>
              </Space>
            </div>
          ))}
        </Card>
      )}

      {logs.length > 0 && (
        <Card size="small" title="事件日志">
          <div
            style={{
              height: "200px",
              overflow: "auto",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </Card>
      )}
    </Space>
  );
};

export default App;
