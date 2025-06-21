import React from "react";
import { Layout, Typography } from "antd";
import { MultiServerUploadTest } from "./components/MultiServerUploadTest";
import "./App.css";


const { Content, Header } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
          🚀 BigUpload 三服务器上传测试
        </Title>
      </Header>
      <Layout>
        <Content style={{ background: "#f0f2f5" }}>
          <MultiServerUploadTest />
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
