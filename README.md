# BigUpload - 大文件上传解决方案

<div align="center">

![BigUpload Logo](https://img.shields.io/badge/BigUpload-v1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Java](https://img.shields.io/badge/Java-11+-orange.svg)

**支持分片上传、断点续传、秒传的多语言实现方案**

[快速开始](#快速开始) • [后端包](#后端包) • [前端组件](#前端组件) • [演示](#演示)

</div>

## 🎯 项目概述

BigUpload 是一个企业级大文件上传解决方案，提供**开箱即用的包**和组件，支持分片上传、断点续传、秒传等高级功能。

### 🌟 核心特性

- ✅ **分片上传** - 2MB 默认分片，支持超大文件
- ✅ **断点续传** - 基于 SHA-256 哈希的智能续传
- ✅ **秒传功能** - 文件哈希验证，相同文件瞬间完成
- ✅ **多语言支持** - Node.js、Python、Java 三种后端实现
- ✅ **前端组件** - React Hook 和组件，即插即用
- ✅ **并发控制** - 可配置并发上传数量
- ✅ **进度追踪** - 实时上传进度和速度显示

## 🚀 快速开始

### 一键启动演示

```bash
# 克隆项目
git clone <repository-url>
cd bigupload

# 启动所有后端服务
./start-all-servers.sh

# 访问演示页面
open test-all-backends.html
```

### 单独部署

选择你需要的后端，查看对应文档：

- [Node.js 部署指南](docs/node-backend.md#部署说明)
- [Python 部署指南](docs/python-backend.md#部署说明)  
- [Java 部署指南](docs/java-backend.md#部署说明)
  
### 服务地址

- **Node.js 后端**: http://localhost:3000
- **Python 后端**: http://localhost:5000  
- **Java 后端**: http://localhost:8080
- **React 演示**: http://localhost:3001

## 📦 后端包

选择你熟悉的语言，一行代码集成大文件上传功能：

### [Node.js 包](docs/node-backend.md)

```bash
npm install @bigupload/node-backend
```

```javascript
const { createUploadServer } = require('@bigupload/node-backend');

createUploadServer({ port: 3000 }).start();
```

### [Python 包](docs/python-backend.md)

```bash
pip install bigupload-fastapi
```

```python
from bigupload_fastapi import create_upload_router
from fastapi import FastAPI

app = FastAPI()
app.include_router(create_upload_router(), prefix="/api/upload")
```

### [Java 包](docs/java-backend.md)

```xml
<dependency>
    <groupId>com.bigupload</groupId>
    <artifactId>bigupload-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

## 🎨 前端组件

### [React 组件](docs/react-frontend.md)

```bash
npm install @bigupload/react
```

```jsx
import { BigUploader } from '@bigupload/react';

<BigUploader
  endpoint="http://localhost:3000"
  onSuccess={(result) => console.log('上传成功:', result)}
/>
```

### React Hook

```jsx
import { useBigUpload } from '@bigupload/react';

const { upload, progress, status } = useBigUpload({
  endpoint: 'http://localhost:3000'
});
```

## 📡 统一 API

所有后端实现都遵循相同的 RESTful API 规范：

| 功能 | Node.js | Python | Java |
|------|---------|--------|------|
| 健康检查 | `GET /health` | `GET /api/upload/health` | `GET /api/upload/health` |
| 文件验证 | `POST /verify` | `POST /api/upload/verify` | `POST /api/upload/verify` |
| 分片上传 | `POST /upload-chunk` | `POST /api/upload/upload` | `POST /api/upload/upload-chunk` |
| 分片合并 | `POST /merge-chunks` | `POST /api/upload/merge` | `POST /api/upload/merge-chunks` |
| 文件下载 | `GET /files/{name}` | `GET /files/{name}` | `GET /api/upload/files/{name}` |

## 🏗️ 项目结构

```
BigUpload/
├── packages/
│   ├── backend/
│   │   ├── node/          # Node.js + Express + TypeScript
│   │   ├── python/        # Python + FastAPI + uvloop  
│   │   └── java/          # Java + Spring Boot + Maven
│   └── frontend/          # React + TypeScript 组件库
├── apps/
│   └── demo-react/        # React 演示应用
├── docs/                  # 各技术栈详细文档
└── *.sh                   # 一键启动脚本
```

## 🛠️ 配置说明

### 通用配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `uploadPath` | 文件上传路径 | `./uploads` |
| `tempPath` | 临时文件路径 | `./uploads/temp` |
| `chunkSize` | 分片大小 | `2MB` |
| `maxFileSize` | 最大文件大小 | `0` (无限制) |
| `concurrent` | 并发上传数 | `3` |

### 支持的文件格式

- **图片**: jpg, png, gif, webp, svg 等 50+ 格式
- **视频**: mp4, avi, mov, webm, mkv 等 30+ 格式  
- **音频**: mp3, wav, flac, aac, ogg 等 20+ 格式
- **文档**: pdf, doc, xls, ppt, txt 等
- **压缩**: zip, rar, 7z, tar, gz 等

## 🚀 部署选项

### Docker 一键部署

```bash
# 启动所有服务
docker-compose up -d

# 访问服务
curl http://localhost/api/upload/health
```


## 🧪 演示和测试

### 在线演示

- 打开 `test-all-backends.html` 测试三种后端
- 访问 React 演示应用测试组件

### 功能测试

- ✅ 小文件上传 (< 10MB)
- ✅ 大文件上传 (> 100MB)  
- ✅ 断点续传测试
- ✅ 秒传功能测试
- ✅ 并发上传测试

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🙏 致谢

感谢以下开源项目：
- [Express.js](https://expressjs.com/) - Node.js Web 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web 框架  
- [Spring Boot](https://spring.io/projects/spring-boot) - Java 应用框架
- [React](https://reactjs.org/) - 前端 UI 库

---

<div align="center">
Made with ❤️ by BigUpload Team
</div>
