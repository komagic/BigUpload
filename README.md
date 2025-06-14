# BigUpload - 企业级大文件上传解决方案

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)]()

企业级大文件上传解决方案，支持分片上传、断点续传、秒传等核心功能。采用前后端分离架构，提供多种技术栈的完整实现。

## 🌟 核心特性

### 📁 全面文件格式支持
- **图片格式**: JPG, PNG, GIF, WebP, TIFF, SVG, BMP, AVIF, HEIC, PSD, AI, EPS等
- **视频格式**: MP4, AVI, MOV, MKV, WebM, FLV, WMV, ProRes, DNxHD, R3D等专业格式
- **音频格式**: MP3, WAV, FLAC, AAC, OGG, WMA, APE, DSD等无损格式
- **文档格式**: DOC, PDF, TXT, PPT, XLS, 各种代码文件, 电子书格式
- **压缩格式**: ZIP, RAR, 7Z, TAR, DMG, ISO等
- **专业格式**: CAD文件, 3D模型, 数据库文件, 字体文件等

### 🚀 上传功能
- **分片上传**: 可配置分片大小，支持大文件上传
- **断点续传**: 支持暂停、继续、重试机制
- **秒传功能**: 基于SHA-256文件哈希的秒传
- **并发控制**: 可配置并发上传数量
- **进度监控**: 实时进度反馈和速度显示
- **错误处理**: 完善的错误处理和重试机制

### 🎨 UI组件
- **多种UI风格**: 基础组件、Ant Design组件、Vue组件
- **响应式设计**: 适配不同屏幕尺寸
- **拖拽上传**: 支持文件拖拽到指定区域上传
- **主题定制**: 可自定义样式主题

### 🔧 技术架构
- **核心引擎**: 纯TypeScript实现，框架无关
- **前端支持**: React 18, Vue 3, 原生JavaScript
- **后端支持**: Node.js, Java, Python
- **类型安全**: 完整的TypeScript类型支持

## 📦 项目结构

```
packages/
├── frontend/          # 前端核心包
│   ├── src/
│   │   ├── core/             # 核心引擎
│   │   ├── hooks/            # React Hooks
│   │   ├── components/       # UI组件
│   │   ├── constants/        # 文件类型配置
│   │   └── utils/           # 工具函数
│   └── dist/               # 构建输出
├── backend/           # 后端实现
│   ├── node/               # Node.js实现
│   ├── java/               # Java实现
│   └── python/             # Python实现
├── shared/            # 共享类型定义
├── docs/              # 项目文档
└── demo/              # 示例应用
```

## 🚀 快速开始

### 安装

```bash
npm install @bigupload/react
# 或
yarn add @bigupload/react
```

### 基础使用

```jsx
import { BigUploader, PREDEFINED_TYPES } from '@bigupload/react';

function App() {
  return (
    <BigUploader
      baseUrl="http://localhost:3000"
      maxFileSize={1024 * 1024 * 1024} // 1GB
      accept={PREDEFINED_TYPES.ALL_IMAGES} // 支持所有图片格式
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

### Ant Design风格

```jsx
import { BigAntUploader, VIDEO_TYPES } from '@bigupload/react';

function VideoUploader() {
  return (
    <BigAntUploader
      baseUrl="http://localhost:3000"
      maxFileSize={5 * 1024 * 1024 * 1024} // 5GB
      chunkSize={10 * 1024 * 1024}         // 10MB分片
      accept={VIDEO_TYPES.EXTENSIONS}       // 支持所有视频格式
      title="视频文件上传"
      description="支持MP4、AVI、MOV等各种视频格式"
      showDragger={true}
    />
  );
}
```

### 自定义文件类型

```jsx
import { BigUploader, FileTypeUtils } from '@bigupload/react';

// 使用预定义类型组合
const customAccept = [
  ...IMAGE_TYPES.EXTENSIONS,  // 所有图片
  ...VIDEO_TYPES.EXTENSIONS,  // 所有视频
  '.pdf', '.doc', '.docx'     // 特定文档
];

// 文件类型验证
const handleFileSelect = (files) => {
  files.forEach(file => {
    const category = FileTypeUtils.getFileCategory(file);
    console.log(`文件 ${file.name} 类型: ${category}`);
    
    if (FileTypeUtils.isVideo(file)) {
      // 针对视频文件的特殊处理
      console.log('这是视频文件，使用大分片上传');
    }
  });
};
```

## 📚 文件类型支持

### 预定义类型

```javascript
import { PREDEFINED_TYPES } from '@bigupload/react';

// 所有文件
PREDEFINED_TYPES.ALL

// 所有图片 (50+ 格式)
PREDEFINED_TYPES.ALL_IMAGES

// 所有视频 (30+ 格式)
PREDEFINED_TYPES.ALL_VIDEOS

// 所有音频 (20+ 格式)
PREDEFINED_TYPES.ALL_AUDIO

// 所有文档
PREDEFINED_TYPES.ALL_DOCUMENTS

// 媒体文件 (图片+视频+音频)
PREDEFINED_TYPES.MEDIA

// 常用文件
PREDEFINED_TYPES.COMMON
```

### 专业格式支持

#### 图片设计文件
- **Adobe**: PSD, AI, EPS, InDD
- **Sketch**: .sketch
- **Figma**: .fig
- **相机RAW**: CR2, NEF, ARW, DNG等

#### 专业视频格式
- **广播级**: MXF, ProRes, DNxHD
- **电影级**: R3D, BRAW
- **高分辨率**: 4K, 8K, UHD

#### 工程文件
- **CAD**: DWG, DXF, STEP, IGES
- **3D**: OBJ, FBX, GLTF, USD

### 最佳实践

```javascript
// 根据业务场景优化配置
const configs = {
  // 图片上传
  images: {
    accept: PREDEFINED_TYPES.ALL_IMAGES,
    maxFileSize: 50 * 1024 * 1024,  // 50MB
    chunkSize: 1 * 1024 * 1024,     // 1MB
    concurrent: 5
  },
  
  // 视频上传
  videos: {
    accept: PREDEFINED_TYPES.ALL_VIDEOS,
    maxFileSize: 5 * 1024 * 1024 * 1024,  // 5GB
    chunkSize: 10 * 1024 * 1024,          // 10MB
    concurrent: 2
  },
  
  // 文档上传
  documents: {
    accept: PREDEFINED_TYPES.ALL_DOCUMENTS,
    maxFileSize: 100 * 1024 * 1024,  // 100MB
    chunkSize: 2 * 1024 * 1024,      // 2MB
    concurrent: 3
  }
};
```

## 🔧 核心引擎

直接使用核心引擎，适合需要完全自定义UI的场景：

```javascript
import { BigUploadEngine } from '@bigupload/react';

const engine = new BigUploadEngine({
  baseUrl: 'http://localhost:3000',
  chunkSize: 2 * 1024 * 1024,
  concurrent: 3
});

// 监听事件
engine.on('progress', ({ fileId, progress }) => {
  console.log(`文件 ${fileId} 上传进度: ${progress.percent}%`);
});

engine.on('success', ({ fileId, result }) => {
  console.log(`文件 ${fileId} 上传成功`);
});

// 添加文件并开始上传
const fileId = await engine.addFile(file);
await engine.startUpload(fileId);
```

## 🎮 示例和演示

### 在线演示
- 🌐 **Web演示**: [http://localhost:5173](http://localhost:5173)
- 📱 **移动端适配**: 响应式设计，支持移动设备

### 本地运行

```bash
# 克隆项目
git clone <repository-url>
cd bigupload

# 安装依赖
npm install

# 构建项目
npm run build

# 启动演示
npm run dev
```

### 演示功能
- ✅ 多种文件格式上传测试
- ✅ 不同UI风格展示
- ✅ 大文件分片上传
- ✅ 断点续传功能
- ✅ 批量文件上传
- ✅ 实时进度监控

## 🏗️ 后端集成

### Node.js
```javascript
const express = require('express');
const { BigUploadHandler } = require('@bigupload/node');

const app = express();
const uploadHandler = new BigUploadHandler({
  uploadDir: './uploads',
  maxFileSize: 5 * 1024 * 1024 * 1024 // 5GB
});

app.use('/upload', uploadHandler.router);
```

### Java Spring Boot
```java
@RestController
@RequestMapping("/upload")
public class BigUploadController {
    
    @Autowired
    private BigUploadService uploadService;
    
    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody VerifyRequest request) {
        return uploadService.verifyFile(request);
    }
}
```

### Python FastAPI
```python
from fastapi import FastAPI
from bigupload import BigUploadRouter

app = FastAPI()
upload_router = BigUploadRouter(
    upload_dir="./uploads",
    max_file_size=5 * 1024 * 1024 * 1024  # 5GB
)

app.include_router(upload_router, prefix="/upload")
```

## 📖 文档

- 📚 [完整文档](./packages/docs/)
- 🎯 [API参考](./packages/docs/api.md)
- 📁 [文件类型支持](./packages/docs/file-types.md)
- 🏗️ [架构设计](./packages/docs/architecture.md)
- 🔧 [自定义开发](./packages/docs/customization.md)

## 🤝 贡献

欢迎提交Issues和Pull Requests！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有贡献者和开源社区的支持！

---

**BigUpload** - 让大文件上传变得简单高效！ 🚀 