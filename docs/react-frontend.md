# React 前端组件

## 🚀 快速开始

### 安装包

```bash
npm install @bigupload/react
```

### 基础使用

```jsx
import { BigUploader } from '@bigupload/react';

function App() {
  return (
    <BigUploader
      endpoint="http://localhost:3000"
      onSuccess={(result) => console.log('上传成功:', result)}
      onError={(error) => console.error('上传失败:', error)}
      onProgress={(progress) => console.log('进度:', progress)}
    />
  );
}
```

### Ant Design 组件

```jsx
import { BigAntUploader } from '@bigupload/react';

function App() {
  return (
    <BigAntUploader
      endpoint="http://localhost:3000"
      multiple={true}
      accept="image/*,video/*"
      maxSize={100 * 1024 * 1024} // 100MB
      onSuccess={(result) => console.log('上传成功:', result)}
    />
  );
}
```

### Hook 使用

```jsx
import { useBigUpload } from '@bigupload/react';

function MyUploader() {
  const { upload, progress, status } = useBigUpload({
    endpoint: 'http://localhost:3000',
    chunkSize: 2 * 1024 * 1024,
    concurrent: 3
  });

  const handleFileSelect = (file) => {
    upload(file);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleFileSelect(e.target.files[0])} />
      {status === 'uploading' && <div>进度: {progress}%</div>}
    </div>
  );
}
```

就这样！🎉 大文件上传组件已就绪。

## 📦 组件 API

### BigUploader Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `endpoint` | string | - | 上传服务端点 |
| `chunkSize` | number | `2MB` | 分片大小 |
| `concurrent` | number | `3` | 并发数量 |
| `accept` | string | - | 接受的文件类型 |
| `maxSize` | number | - | 最大文件大小 |
| `onSuccess` | function | - | 成功回调 |
| `onError` | function | - | 失败回调 |
| `onProgress` | function | - | 进度回调 |

### useBigUpload Hook

```typescript
const {
  upload,      // 上传函数
  progress,    // 上传进度 (0-100)
  status,      // 状态: 'idle' | 'uploading' | 'success' | 'error'
  pause,       // 暂停上传
  resume,      // 继续上传
  cancel       // 取消上传
} = useBigUpload(options);
```

---

[返回主文档](../README.md) 