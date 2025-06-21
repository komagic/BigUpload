# Python 后端 - PyPI 包

## 🚀 快速开始

### 安装包

```bash
pip install bigupload-fastapi
```

### 基础使用

```python
from bigupload_fastapi import create_upload_router
from fastapi import FastAPI

app = FastAPI()

# 创建并挂载上传路由
upload_router = create_upload_router(
    upload_path="./uploads",
    temp_path="./uploads/temp",
    base_url="http://localhost:5000",
    max_file_size=0,  # 0 = 不限制
    chunk_size=2 * 1024 * 1024,  # 2MB
    concurrent=3
)

app.include_router(upload_router, prefix="/api/upload")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

### Django 集成

```python
# django_project/urls.py
from bigupload_fastapi import create_django_views

urlpatterns = [
    path('api/upload/', include(create_django_views())),
]
```

就这样！🎉 大文件上传服务已就绪。

## 📡 API 端点

- **健康检查**: `GET /api/upload/health`
- **文件验证**: `POST /api/upload/verify`
- **分片上传**: `POST /api/upload/upload`
- **分片合并**: `POST /api/upload/merge`
- **文件下载**: `GET /files/{filename}`

---

[返回主文档](../README.md) 