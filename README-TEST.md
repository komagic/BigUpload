# BigUpload 测试指南

## 🚀 快速开始

本项目提供了完整的大文件上传解决方案，支持三种后端技术栈：

### 1. 启动后端服务

#### Node.js 后端 (端口: 3000)
```bash
cd packages/backend/node
npm install
npm run dev
```

#### Python FastAPI 后端 (端口: 5000)
```bash
cd packages/backend/python
pip install -r requirements.txt
python main.py
```

#### Java Spring Boot 后端 (端口: 8080)
```bash
cd apps/demo-java
mvn spring-boot:run
```

### 2. 运行测试页面

直接在浏览器中打开项目根目录下的 `test-page.html` 文件。

或者使用Python简单服务器：
```bash
python -m http.server 8000
# 然后访问 http://localhost:8000/test-page.html
```

## 🧪 测试功能

### 核心功能测试

1. **后端切换测试**
   - 在测试页面顶部选择不同的后端服务
   - 测试三个后端的兼容性

2. **文件上传测试**
   - 拖拽文件到上传区域
   - 或点击"选择文件"按钮选择文件
   - 支持多文件选择

3. **大文件分片测试**
   - 上传大于 2MB 的文件测试分片功能
   - 分片大小默认为 2MB

4. **断点续传测试**
   - 上传过程中刷新页面
   - 重新上传相同文件，观察断点续传效果

5. **秒传功能测试**
   - 上传完成的文件再次上传
   - 应该直接返回成功，不重复上传

### 高级测试

1. **并发上传测试**
   - 同时选择多个文件上传
   - 观察并发处理效果

2. **错误处理测试**
   - 关闭后端服务，测试错误处理
   - 上传超大文件测试限制处理

3. **性能测试**
   - 上传不同大小的文件
   - 观察上传速度和内存使用

## 📋 API 接口说明

### 通用接口（三个后端都支持）

#### 1. 验证文件 - POST /verify
请求体：
```json
{
  "fileId": "unique-file-id",
  "fileName": "example.mp4",
  "fileHash": "sha256-hash",
  "fileSize": 1048576,
  "chunkTotal": 1
}
```

响应：
```json
{
  "success": true,
  "exists": false,
  "fileId": "unique-file-id",
  "uploadedChunks": [],
  "message": "文件不存在，可以开始上传",
  "finish": false
}
```

#### 2. 上传分片 - POST /upload-chunk (Node.js) 或 /upload (Python/Java)
Form Data：
- `chunk`: 分片文件
- `fileId`: 文件ID
- `fileName`: 文件名
- `chunkIndex`: 分片索引
- `chunkTotal`: 分片总数
- `fileHash`: 文件哈希

#### 3. 合并分片 - POST /merge-chunks (Node.js) 或 /merge (Python/Java)
请求体：
```json
{
  "fileId": "unique-file-id",
  "fileName": "example.mp4",
  "fileHash": "sha256-hash",
  "chunkTotal": 5,
  "fileSize": 10485760
}
```

### 健康检查
- Node.js: GET http://localhost:3000/
- Python: GET http://localhost:5000/api/upload/health
- Java: GET http://localhost:8080/api/upload/health

## 🔧 配置说明

### Node.js 配置
配置文件：`packages/backend/node/.env`
```env
PORT=3000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5368709120
CHUNK_SIZE=2097152
```

### Python 配置
配置在 `main.py` 中：
```python
upload_router = create_upload_router(
    upload_path="./uploads",
    temp_path="./uploads/temp",
    base_url="http://localhost:5000",
    max_file_size=0,  # 0表示不限制
    chunk_size=2 * 1024 * 1024,  # 2MB
    concurrent=3,
    enable_file_server=True,
    file_server_path="/files"
)
```

### Java 配置
配置文件：`apps/demo-java/src/main/resources/application.yml`
```yaml
bigupload:
  upload-path: ./uploads
  temp-path: ./uploads/temp
  base-url: http://localhost:8080
  max-file-size: 0
  chunk-size: 2097152
  concurrent: 3
  enable-file-server: true
  file-server-path: /files
```

## 🐛 故障排除

### 常见问题

1. **CORS 错误**
   - 确保后端服务已正确配置 CORS
   - 检查请求的URL是否正确

2. **文件上传失败**
   - 检查上传目录权限
   - 查看后端服务日志
   - 确认文件大小没有超过限制

3. **端口冲突**
   - 检查端口是否被占用
   - 修改配置文件中的端口设置

4. **依赖安装失败**
   - Node.js: 确保 Node.js 版本 >= 14
   - Python: 确保 Python 版本 >= 3.7
   - Java: 确保 Java 版本 >= 8

### 日志查看

- **Node.js**: 控制台输出
- **Python**: 控制台输出 + FastAPI 日志
- **Java**: 控制台输出 + Spring Boot 日志

## 📊 性能基准

### 推荐配置

| 文件类型 | 分片大小 | 并发数 | 适用场景 |
|---------|---------|-------|---------|
| 图片/文档 | 1MB | 5 | 小文件批量上传 |
| 视频 | 10MB | 2 | 大视频文件 |
| 音频 | 2MB | 3 | 音频文件 |
| 压缩包 | 5MB | 3 | 压缩文件 |

### 性能指标

- **上传速度**: 取决于网络带宽和服务器性能
- **内存使用**: 每个分片约占用分片大小的内存
- **并发处理**: 建议不超过 CPU 核心数

## 🔐 安全考虑

1. **文件类型验证**: 在生产环境中启用严格的文件类型检查
2. **文件大小限制**: 设置合理的文件大小上限
3. **访问控制**: 添加用户认证和授权
4. **病毒扫描**: 对上传的文件进行安全扫描
5. **存储安全**: 使用安全的文件存储策略

## 📝 开发指南

### 扩展功能

1. **自定义存储**: 支持云存储（AWS S3、阿里云 OSS 等）
2. **数据库集成**: 使用数据库存储文件元数据
3. **用户系统**: 集成用户认证和权限管理
4. **监控告警**: 添加文件上传监控和告警
5. **CDN 集成**: 支持 CDN 加速下载

### 贡献代码

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request

---

**BigUpload** - 让大文件上传变得简单高效！ 🚀 