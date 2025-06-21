# FastUploader

FastUploader 是一个高性能的大文件上传组件，支持分片上传、断点续传、秒传等功能。它采用 monorepo 架构，提供前端 React 组件和多种后端服务实现，方便在不同技术栈项目中使用。

## 核心功能

- **分片上传**：将大文件切分成小块进行上传
- **断点续传**：支持上传中断后继续上传
- **秒传功能**：检测文件是否已存在，避免重复上传
- **并行上传**：多个分片并行上传提高效率
- **上传进度展示**：实时显示上传进度及速度
- **错误处理**：包括重试机制、超时处理等
- **多平台支持**：前端 React，后端支持 Python、Java、Node.js

## 项目结构

```
bigupload/
├── packages/
│   ├── frontend/           # React前端组件
│   │   ├── src/
│   │   │   ├── hooks/      # React Hooks
│   │   │   ├── components/ # React 组件
│   │   │   └── __tests__/  # 测试文件
│   │   ├── jest.config.js  # Jest 配置
│   │   └── tsconfig.test.json # 测试TypeScript配置
│   ├── backend/
│   │   ├── python/         # Python Flask后端
│   │   ├── java/           # Java SpringBoot后端
│   │   └── node/           # Node.js Express后端
│   └── shared/             # 共享类型和接口定义
├── apps/
│   ├── demo-react/         # React示例应用
│   ├── demo-python/        # Python示例应用
│   ├── demo-java/          # Java示例应用
│   └── demo-node/          # Node.js示例应用
└── docs/                   # 文档
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 构建所有包

```bash
npm run build
```

### 运行测试

```bash
# 运行前端测试
cd packages/frontend
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

### 启动演示应用

```bash
# 启动React演示应用
npm run dev --filter=@bigupload/demo-react

# 启动Node.js后端
npm run dev --filter=@bigupload/backend-node

# 启动Python后端
npm run dev --filter=@bigupload/backend-python
```

## 前端组件使用

### 安装

```bash
npm install @bigupload/react
```

### 基本使用

```jsx
import React from "react";
import { FastUploader } from "@bigupload/react";

function App() {
  return (
    <div>
      <h1>文件上传</h1>
      <FastUploader
        url="http://localhost:3000"
        chunkSize={2 * 1024 * 1024} // 2MB
        concurrent={3}
        onSuccess={(response) => console.log("上传成功", response)}
        onError={(error) => console.error("上传错误", error)}
        onProgress={(progress) => console.log("上传进度", progress)}
      />
    </div>
  );
}
```

### 组件 API

#### 属性

| 属性名      | 类型     | 默认值 | 说明                               |
| ----------- | -------- | ------ | ---------------------------------- |
| url         | string   | -      | 上传服务器地址（必填）             |
| chunkSize   | number   | 2MB    | 分片大小（字节）                   |
| concurrent  | number   | 3      | 并发上传数                         |
| autoUpload  | boolean  | true   | 是否自动上传                       |
| dragDrop    | boolean  | true   | 是否允许拖拽上传                   |
| multiple    | boolean  | false  | 是否允许多文件上传                 |
| accept      | string   | -      | 接受的文件类型                     |
| maxFileSize | number   | 0      | 最大文件大小（字节，0 表示不限制） |
| onSuccess   | function | -      | 上传成功回调                       |
| onError     | function | -      | 上传错误回调                       |
| onProgress  | function | -      | 上传进度回调                       |
| headers     | object   | -      | 自定义 HTTP 头                     |
| className   | string   | -      | 自定义 CSS 类名                    |

## 后端 API

所有后端实现提供统一的 API 接口：

### 1. 验证文件是否存在

```
POST /verify
Content-Type: application/json

{
  "fileHash": "文件的MD5哈希值",
  "fileName": "文件名",
  "fileSize": 文件大小
}
```

### 2. 上传分片

```
POST /upload-chunk
Content-Type: multipart/form-data

{
  "chunk": 文件分片,
  "fileId": "文件唯一标识",
  "fileName": "文件名",
  "chunkIndex": 分片索引,
  "chunkTotal": 总分片数,
  "fileHash": "文件的MD5哈希值"
}
```

### 3. 合并分片

```
POST /merge-chunks
Content-Type: application/json

{
  "fileId": "文件唯一标识",
  "fileName": "文件名",
  "fileHash": "文件的MD5哈希值",
  "chunkTotal": 总分片数
}
```

## 贡献指南

欢迎提交 Pull Request 和 Issue。在贡献代码前，请确保阅读以下指南：

1. Fork 本仓库
2. 创建新的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证。详见[LICENSE](LICENSE)文件。
