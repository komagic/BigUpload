# Node.js 后端 - NPM 包

## 🚀 快速开始

### 安装包

```bash
npm install @bigupload/node-backend
```

### 基础使用

```javascript
const { createUploadServer } = require('@bigupload/node-backend');

const server = createUploadServer({
  port: 3000,
  uploadPath: './uploads',
  tempPath: './uploads/temp',
  chunkSize: 2 * 1024 * 1024,  // 2MB
  maxFileSize: 0,              // 0 = 不限制
  concurrent: 3
});

server.start();
```

### Express 集成

```javascript
const express = require('express');
const { createUploadRouter } = require('@bigupload/node-backend');

const app = express();

// 挂载上传路由
app.use('/api/upload', createUploadRouter({
  uploadPath: './uploads',
  tempPath: './uploads/temp'
}));

app.listen(3000);
```

就这样！🎉 大文件上传服务已就绪。

## 📡 API 端点

- **健康检查**: `GET /health`
- **文件验证**: `POST /verify`
- **分片上传**: `POST /upload-chunk`
- **分片合并**: `POST /merge-chunks`
- **文件下载**: `GET /files/{filename}`

---

[返回主文档](../README.md) 