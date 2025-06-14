# @bigupload/react - 大文件上传前端组件库

基于统一架构的大文件上传前端解决方案，支持分片上传、断点续传、秒传功能。**UI与逻辑完全分离**，方便第三方集成。

## ✨ 特性

- 🚀 **核心引擎**：纯TypeScript实现，不依赖任何UI框架
- ⚛️ **React Hook**：提供`useBigUpload` Hook，方便React项目集成
- 🎨 **多UI组件**：提供基础组件和Ant Design组件
- 🔗 **统一API**：与Java/Python/Node.js后端使用相同的接口
- 📦 **分片上传**：大文件自动分片，支持并发上传
- ⏸️ **断点续传**：支持暂停/继续/重试机制
- ⚡ **秒传功能**：基于文件哈希的快速上传
- 🎯 **类型安全**：完整的TypeScript类型支持

## 📦 安装

```bash
npm install @bigupload/react
# 或
yarn add @bigupload/react
```

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
├─────────────────┬─────────────────┬─────────────────────────┤
│   BigUploader   │ BigAntUploader  │    BigVueUploader       │
│  (基础组件)     │ (Ant Design)    │     (Vue 3)             │
└─────────────────┴─────────────────┴─────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   React Hook Layer                          │
│                   useBigUpload                              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Core Engine Layer                         │
│                  BigUploadEngine                            │
│            (纯逻辑，无UI依赖，框架无关)                     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Backend API Layer                         │
│         POST /verify  |  POST /upload  |  POST /merge       │
│         Java/Python/Node.js 统一接口                       │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 基础组件使用

```tsx
import { BigUploader } from '@bigupload/react';

function App() {
  return (
    <BigUploader
      baseUrl="http://localhost:3000"
      maxFiles={5}
      maxFileSize={100 * 1024 * 1024} // 100MB
      accept={['.jpg', '.png', '.pdf']}
      onSuccess={(fileId, result) => {
        console.log('上传成功:', result);
      }}
      onError={(fileId, error) => {
        console.error('上传失败:', error);
      }}
    />
  );
}
```

### 2. Ant Design组件

```tsx
import { BigAntUploader } from '@bigupload/react';

function App() {
  return (
    <BigAntUploader
      baseUrl="http://localhost:3000"
      title="文件上传"
      description="支持拖拽上传，支持大文件分片上传、断点续传、秒传"
      showDragger={true}
      maxFiles={10}
      maxFileSize={500 * 1024 * 1024} // 500MB
    />
  );
}
```

### 3. 使用React Hook

```tsx
import { useBigUpload } from '@bigupload/react';

function CustomUploader() {
  const {
    files,
    addFiles,
    startUpload,
    pauseUpload,
    resumeUpload,
    isUploading,
    totalProgress
  } = useBigUpload({
    baseUrl: 'http://localhost:3000',
    autoStart: true,
    maxFiles: 10,
    chunkSize: 5 * 1024 * 1024 // 5MB
  });

  const handleFileSelect = (event) => {
    addFiles(event.target.files);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileSelect} />
      
      <div>总体进度: {totalProgress.percent}%</div>
      
      {files.map(file => (
        <div key={file.fileId}>
          <span>{file.file.name}</span>
          <span>{file.status}</span>
          <span>{file.progress.percent}%</span>
          
          {file.status === 'uploading' && (
            <button onClick={() => pauseUpload(file.fileId)}>暂停</button>
          )}
          {file.status === 'paused' && (
            <button onClick={() => resumeUpload(file.fileId)}>继续</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 4. 直接使用核心引擎

```tsx
import { BigUploadEngine, createUploadEngine } from '@bigupload/react';

// 创建引擎实例
const engine = createUploadEngine('http://localhost:3000', {
  chunkSize: 2 * 1024 * 1024, // 2MB
  concurrent: 3,
  debug: true
});

// 监听事件
engine.on('progress', ({ fileId, progress }) => {
  console.log('上传进度:', progress.percent + '%');
});

engine.on('success', ({ fileId, result }) => {
  console.log('上传成功:', result);
});

engine.on('error', ({ fileId, error }) => {
  console.error('上传失败:', error);
});

// 添加文件并开始上传
async function uploadFile(file) {
  const fileId = await engine.addFile(file);
  await engine.startUpload(fileId);
}
```

## 📚 API参考

### BigUploadEngine 核心引擎

```typescript
interface UploadConfig {
  baseUrl: string;                    // 后端API基础URL
  chunkSize?: number;                 // 分片大小（字节），默认2MB
  concurrent?: number;                // 并发上传数量，默认3
  retryCount?: number;                // 重试次数，默认3
  retryDelay?: number;                // 重试延迟（毫秒），默认1000
  headers?: Record<string, string>;   // 请求头
  debug?: boolean;                    // 是否启用调试日志
}

class BigUploadEngine {
  constructor(config: UploadConfig)
  
  // 文件管理
  addFile(file: File): Promise<string>
  removeFile(fileId: string): void
  getFileState(fileId: string): FileUploadState | undefined
  getAllFiles(): FileUploadState[]
  
  // 上传控制
  startUpload(fileId: string): Promise<void>
  pauseUpload(fileId: string): void
  resumeUpload(fileId: string): Promise<void>
  cancelUpload(fileId: string): void
  
  // 事件监听
  on<T>(event: UploadEventType, handler: (data: T) => void): () => void
  off(event: UploadEventType, handler?: (data: any) => void): void
}
```

### useBigUpload Hook

```typescript
interface UseBigUploadOptions extends Omit<UploadConfig, 'baseUrl'> {
  baseUrl: string;
  autoStart?: boolean;        // 自动开始上传
  maxFiles?: number;          // 最大文件数量
  accept?: string[];          // 允许的文件类型
  maxFileSize?: number;       // 单个文件最大大小
}

interface UseBigUploadReturn {
  engine: BigUploadEngine;    // 引擎实例
  files: FileUploadState[];   // 所有文件状态
  isUploading: boolean;       // 是否有文件正在上传
  addFiles: (files: FileList | File[]) => Promise<string[]>;
  startUpload: (fileId?: string) => Promise<void>;
  pauseUpload: (fileId: string) => void;
  resumeUpload: (fileId: string) => Promise<void>;
  cancelUpload: (fileId: string) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  totalProgress: UploadProgress;
}
```

### 组件属性

#### BigUploader

```typescript
interface BigUploaderProps extends UseBigUploadOptions {
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  dragText?: string;
  buttonText?: string;
  showFileList?: boolean;
  showTotalProgress?: boolean;
  renderFileList?: (files: FileUploadState[]) => React.ReactNode;
  onSuccess?: (fileId: string, result: any) => void;
  onError?: (fileId: string, error: any) => void;
  onProgress?: (fileId: string, progress: any) => void;
}
```

#### BigAntUploader

```typescript
interface BigAntUploaderProps extends UseBigUploadOptions {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  description?: string;
  showDragger?: boolean;
  showFileList?: boolean;
  showTotalProgress?: boolean;
  listHeight?: number;
  onSuccess?: (fileId: string, result: any) => void;
  onError?: (fileId: string, error: any) => void;
  onProgress?: (fileId: string, progress: any) => void;
}
```

## 🔧 与后端集成

该前端库设计为与统一的后端API配合使用，支持以下后端实现：

### Java (Spring Boot Starter)

```xml
<dependency>
    <groupId>com.bigupload</groupId>
    <artifactId>bigupload-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Python (FastAPI Package)

```bash
pip install bigupload-fastapi
```

### Node.js (Express)

```bash
npm install @bigupload/express
```

所有后端实现都提供统一的API接口：

- `POST /verify` - 验证文件是否已存在
- `POST /upload` - 上传文件分片
- `POST /merge` - 合并所有分片

## 🎯 高级用法

### 自定义文件验证

```tsx
const validateFile = (file: File): boolean => {
  // 自定义验证逻辑
  if (file.size > 100 * 1024 * 1024) {
    alert('文件过大');
    return false;
  }
  
  if (!file.name.endsWith('.pdf')) {
    alert('只支持PDF文件');
    return false;
  }
  
  return true;
};

// 在添加文件前进行验证
const handleFileSelect = async (files: FileList) => {
  const validFiles = Array.from(files).filter(validateFile);
  await addFiles(validFiles);
};
```

### 自定义上传头信息

```tsx
const engine = new BigUploadEngine({
  baseUrl: 'http://localhost:3000',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'custom-value'
  }
});
```

### 监听详细事件

```tsx
engine.on('stateChange', ({ fileId, state }) => {
  console.log(`文件 ${state.file.name} 状态变为: ${state.status}`);
});

engine.on('progress', ({ fileId, progress }) => {
  console.log(`文件上传进度: ${progress.percent}%`);
  console.log(`上传速度: ${progress.speed} bytes/s`);
  console.log(`剩余时间: ${progress.remainingTime}s`);
});
```

## 🔍 故障排除

### 常见问题

1. **CORS错误**
   
   确保后端正确配置了CORS策略，允许前端域名访问。

2. **大文件上传失败**
   
   检查服务器的文件大小限制配置，确保支持大文件上传。

3. **分片上传不稳定**
   
   可以调整`concurrent`参数，降低并发数量以提高稳定性。

### 调试模式

```tsx
const engine = new BigUploadEngine({
  baseUrl: 'http://localhost:3000',
  debug: true  // 启用调试日志
});
```

启用调试模式后，控制台会显示详细的上传日志，便于问题排查。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 GitHub Issue 或联系开发团队。 