# BigUpload - 大文件上传解决方案

<div align="center">

![BigUpload Logo](https://img.shields.io/badge/BigUpload-v1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Java](https://img.shields.io/badge/Java-11+-orange.svg)

**支持分片上传、断点续传、秒传的多语言实现方案**

</div>

## 📋 目录

- [项目概述](#项目概述)
- [核心特性](#核心特性)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [后端使用](#后端使用)
- [前端使用](#前端使用)
- [API 文档](#api文档)
- [配置说明](#配置说明)
- [部署指南](#部署指南)
- [故障排除](#故障排除)

## 🎯 项目概述

BigUpload 是一个企业级大文件上传解决方案，提供三种后端实现（Node.js、Python、Java）和多种前端组件，支持分片上传、断点续传、秒传等高级功能。

### 🌟 核心特性

- ✅ **分片上传** - 2MB 默认分片，支持超大文件
- ✅ **断点续传** - 基于 SHA-256 哈希的智能续传
- ✅ **秒传功能** - 文件哈希验证，相同文件瞬间完成
- ✅ **多语言支持** - Node.js、Python、Java 三种后端实现
- ✅ **并发控制** - 可配置并发上传数量
- ✅ **进度追踪** - 实时上传进度和速度显示
- ✅ **错误处理** - 完善的错误处理和重试机制
- ✅ **文件验证** - 支持多种文件格式验证
- ✅ **CORS 支持** - 完整的跨域请求支持

## 🏗️ 技术架构

```
BigUpload/
├── packages/backend/           # 后端实现
│   ├── node/                  # Node.js + Express + TypeScript
│   ├── python/                # Python + FastAPI + uvloop
│   └── java/                  # Java + Spring Boot + Maven
├── packages/frontend/          # 前端组件
│   ├── react/                 # React + TypeScript 组件
│   ├── vue/                   # Vue 3 组件
│   └── vanilla/               # 原生 JavaScript 组件
├── apps/                      # 演示应用
│   ├── demo-react/            # React 演示应用
│   ├── demo-vue/              # Vue 演示应用
│   └── demo-java/             # Java Spring Boot 演示
└── docs/                      # 文档和测试页面
```

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0
- **Python**: >= 3.8
- **Java**: >= 11
- **Maven**: >= 3.6 (Java 项目)

### 一键启动所有服务

```bash
# 克隆项目
git clone <repository-url>
cd bigupload

# 启动所有后端服务
./start-all-servers.sh

# 或者分别启动
./start-node-python.sh  # 启动 Node.js + Python
```

### 测试服务

打开浏览器访问：

- 测试页面: `test-all-backends.html`
- Node.js 服务: http://localhost:3000
- Python 服务: http://localhost:5000
- Java 服务: http://localhost:8080

## 🖥️ 后端使用

### Node.js 后端

**技术栈**: Express + TypeScript + Multer

```bash
# 安装依赖
cd packages/backend/node
npm install

# 启动开发服务
npm run dev

# 生产构建
npm run build
npm start
```

**配置文件** (`config/default.json`):

```json
{
  "port": 3000,
  "uploadPath": "./uploads",
  "tempPath": "./uploads/temp",
  "chunkSize": 2097152,
  "maxFileSize": 0,
  "concurrent": 3
}
```

### Python 后端

**技术栈**: FastAPI + uvloop + aiofiles

```bash
# 安装依赖 (推荐使用 uv)
cd packages/backend/python
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# 启动开发服务
uv run uvicorn main:app --host 0.0.0.0 --port 5000 --reload

# 生产启动
uv run uvicorn main:app --host 0.0.0.0 --port 5000 --workers 4
```

**配置文件** (`config.py`):

```python
class Config:
    UPLOAD_PATH = "./uploads"
    TEMP_PATH = "./uploads/temp"
    CHUNK_SIZE = 2 * 1024 * 1024  # 2MB
    MAX_FILE_SIZE = 0  # 0 = 无限制
    CONCURRENT = 3
    BASE_URL = "http://localhost:5000"
```

### Java 后端

**技术栈**: Spring Boot + Maven + Spring Web

```bash
# 编译安装 BigUpload Starter
cd packages/backend/java
mvn clean install

# 启动演示应用
cd ../../../apps/demo-java
mvn spring-boot:run
```

**配置文件** (`application.yml`):

```yaml
bigupload:
  upload-path: ./uploads
  temp-path: ./uploads/temp
  base-url: http://localhost:8080
  max-file-size: 0 # 0 = 不限制
  chunk-size: 2097152 # 2MB
  concurrent: 3
  api-prefix: /api/upload
  enable-file-server: true
  file-server-path: /files

server:
  port: 8080

spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 100MB
```

## 🎨 前端使用

### React 组件

```bash
cd packages/frontend/react
npm install
```

**基础使用**:

```jsx
import { BigUploader } from "@bigupload/react";

function App() {
  return (
    <BigUploader
      endpoint="http://localhost:3000"
      chunkSize={2 * 1024 * 1024}
      concurrent={3}
      onProgress={(progress) => console.log("进度:", progress)}
      onSuccess={(result) => console.log("上传成功:", result)}
      onError={(error) => console.error("上传失败:", error)}
    />
  );
}
```

### Vue 组件

```bash
cd packages/frontend/vue
npm install
```

**基础使用**:

```vue
<template>
  <BigUploader
    :endpoint="endpoint"
    :chunk-size="chunkSize"
    :concurrent="3"
    @progress="handleProgress"
    @success="handleSuccess"
    @error="handleError"
  />
</template>

<script setup>
import { BigUploader } from "@bigupload/vue";

const endpoint = "http://localhost:3000";
const chunkSize = 2 * 1024 * 1024;

const handleProgress = (progress) => {
  console.log("进度:", progress);
};

const handleSuccess = (result) => {
  console.log("上传成功:", result);
};

const handleError = (error) => {
  console.error("上传失败:", error);
};
</script>
```

### 原生 JavaScript

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="packages/frontend/vanilla/bigupload.min.js"></script>
  </head>
  <body>
    <div id="uploader"></div>

    <script>
      const uploader = new BigUpload({
        container: "#uploader",
        endpoint: "http://localhost:3000",
        chunkSize: 2 * 1024 * 1024,
        concurrent: 3,
        onProgress: (progress) => console.log("进度:", progress),
        onSuccess: (result) => console.log("上传成功:", result),
        onError: (error) => console.error("上传失败:", error),
      });
    </script>
  </body>
</html>
```

## 📚 API 文档

### 统一接口规范

所有后端实现都遵循相同的 API 规范：

#### 1. 健康检查

**Node.js**: `GET /`
**Python**: `GET /api/upload/health`
**Java**: `GET /api/upload/health`

**响应**:

```json
{
  "name": "服务名称",
  "version": "1.0.0",
  "status": "ok"
}
```

#### 2. 文件验证（秒传/断点续传）

**Node.js**: `POST /verify`
**Python**: `POST /api/upload/verify`
**Java**: `POST /api/upload/verify`

**请求体**:

```json
{
  "filename": "example.pdf",
  "fileHash": "sha256-hash-value",
  "fileSize": 1048576
}
```

**响应**:

```json
{
  "success": true,
  "exists": false,
  "finish": false,
  "uploadedChunks": [],
  "message": "文件不存在，可以开始上传"
}
```

#### 3. 分片上传

**Node.js**: `POST /upload-chunk`
**Python**: `POST /api/upload/upload`
**Java**: `POST /api/upload/upload`

**请求** (FormData):

- `chunk`: 文件分片 (File)
- `chunkIndex`: 分片索引 (Number)
- `fileHash`: 文件哈希值 (String)
- `filename`: 文件名 (String)
- **Java 额外参数**:
  - `fileId`: 文件 ID (String)
  - `fileName`: 文件名 (String)
  - `chunkTotal`: 总分片数 (Number)

**响应**:

```json
{
  "success": true,
  "chunkIndex": 0,
  "uploadedChunks": [0],
  "message": "分片上传成功"
}
```

#### 4. 分片合并

**Node.js**: `POST /merge-chunks`
**Python**: `POST /api/upload/merge`
**Java**: `POST /api/upload/merge`

**请求体**:

**Node.js/Python**:

```json
{
  "fileHash": "sha256-hash-value",
  "filename": "example.pdf",
  "totalChunks": 5
}
```

**Java**:

```json
{
  "fileId": "file-id",
  "fileName": "example.pdf",
  "fileHash": "sha256-hash-value",
  "chunkTotal": 5,
  "fileSize": 1048576
}
```

**响应**:

```json
{
  "success": true,
  "url": "http://localhost:3000/files/file-hash.pdf",
  "message": "文件合并成功"
}
```

## ⚙️ 配置说明

### 通用配置项

| 配置项        | 说明         | 默认值                  | 类型   |
| ------------- | ------------ | ----------------------- | ------ |
| `uploadPath`  | 文件上传路径 | `./uploads`             | String |
| `tempPath`    | 临时文件路径 | `./uploads/temp`        | String |
| `chunkSize`   | 分片大小     | `2097152` (2MB)         | Number |
| `maxFileSize` | 最大文件大小 | `0` (无限制)            | Number |
| `concurrent`  | 并发上传数   | `3`                     | Number |
| `baseUrl`     | 服务基础 URL | `http://localhost:port` | String |

### 支持的文件格式

**图片格式** (50+):
`jpg`, `jpeg`, `png`, `gif`, `bmp`, `svg`, `webp`, `tiff`, `ico`, 等

**视频格式** (30+):
`mp4`, `avi`, `mov`, `wmv`, `flv`, `webm`, `mkv`, `m4v`, 等

**音频格式** (20+):
`mp3`, `wav`, `flac`, `aac`, `ogg`, `wma`, `m4a`, 等

**文档格式**:
`pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `txt`, 等

**压缩格式**:
`zip`, `rar`, `7z`, `tar`, `gz`, `bz2`, 等

## 🚀 部署指南

### Docker 部署

#### Node.js 服务

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY packages/backend/node/ .
RUN npm install --production
EXPOSE 3000
CMD ["npm", "start"]
```

#### Python 服务

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY packages/backend/python/ .
RUN pip install -r requirements.txt
EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
```

#### Java 服务

```dockerfile
FROM openjdk:11-jre-slim
WORKDIR /app
COPY apps/demo-java/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  bigupload-node:
    build:
      context: .
      dockerfile: Dockerfile.node
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads

  bigupload-python:
    build:
      context: .
      dockerfile: Dockerfile.python
    ports:
      - "5000:5000"
    volumes:
      - ./uploads:/app/uploads

  bigupload-java:
    build:
      context: .
      dockerfile: Dockerfile.java
    ports:
      - "8080:8080"
    volumes:
      - ./uploads:/app/uploads

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - bigupload-node
      - bigupload-python
      - bigupload-java
```

### Nginx 负载均衡

```nginx
upstream bigupload_backend {
    server localhost:3000 weight=3;
    server localhost:5000 weight=2;
    server localhost:8080 weight=1;
}

server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 100M;

    location /api/upload/ {
        proxy_pass http://bigupload_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /files/ {
        alias /var/www/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔧 故障排除

### 常见问题

#### 1. CORS 跨域问题

**症状**: 浏览器控制台显示 CORS 错误
**解决**: 确保后端服务已配置 CORS 允许来源

**Node.js**:

```javascript
app.use(
  cors({
    origin: ["http://localhost:3000", "https://your-domain.com"],
    credentials: true,
  })
);
```

**Python**:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 2. 文件大小限制

**症状**: 大文件上传失败
**解决**: 调整服务器文件大小限制

**Java**:

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 500MB
      max-request-size: 500MB
```

#### 3. 分片合并失败

**症状**: 分片上传成功但合并失败
**解决**:

- 检查临时目录权限
- 确认所有分片都已上传
- 验证参数格式是否正确

#### 4. 速度异常

**症状**: 上传速度显示异常
**解决**:

- 检查网络连接
- 调整分片大小
- 降低并发数量

### 性能优化

#### 1. 分片大小调优

```javascript
// 根据网络条件调整
const chunkSize =
  navigator.connection?.effectiveType === "4g"
    ? 5 * 1024 * 1024 // 5MB (高速网络)
    : 1 * 1024 * 1024; // 1MB (低速网络)
```

#### 2. 并发控制

```javascript
// 根据文件大小动态调整
const concurrent = fileSize > 100 * 1024 * 1024 ? 5 : 3;
```

#### 3. 内存优化

```javascript
// 使用流式处理大文件
const stream = file.stream();
const reader = stream.getReader();
```

## 📈 监控和日志

### 日志配置

**Node.js** (winston):

```javascript
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "upload.log" }),
    new winston.transports.Console(),
  ],
});
```

**Python** (loguru):

```python
from loguru import logger

logger.add("upload.log", rotation="100 MB", retention="30 days")
```

**Java** (logback):

```xml
<configuration>
    <appender name="FILE" class="ch.qos.logback.core.FileAppender">
        <file>upload.log</file>
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    <root level="info">
        <appender-ref ref="FILE" />
    </root>
</configuration>
```

### 监控指标

- 上传成功率
- 平均上传速度
- 错误率统计
- 服务响应时间
- 磁盘使用率

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Express](https://expressjs.com/) - Node.js Web 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web 框架
- [Spring Boot](https://spring.io/projects/spring-boot) - Java 应用框架
- [React](https://reactjs.org/) - 前端 UI 库
- [Vue.js](https://vuejs.org/) - 渐进式前端框架

---

<div align="center">
Made with ❤️ by BigUpload Team
</div>
