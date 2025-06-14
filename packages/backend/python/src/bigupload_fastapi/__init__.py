"""
BigUpload FastAPI Package

大文件上传 FastAPI 包，提供开箱即用的大文件上传功能。

主要特性:
- 分片上传
- 断点续传
- 秒传功能
- 文件哈希验证
- 异步处理

使用方法:
```python
from fastapi import FastAPI
from bigupload_fastapi import create_upload_router

app = FastAPI()

# 创建并挂载上传路由
upload_router = create_upload_router(
    upload_path="./uploads",
    temp_path="./uploads/temp",
    base_url="http://localhost:8000"
)
app.include_router(upload_router, prefix="/api/upload")
```
"""

from .router import create_upload_router
from .models import VerifyRequest, VerifyResponse, UploadResponse, MergeRequest, MergeResponse
from .config import UploadConfig

__version__ = "1.0.0"
__author__ = "BigUpload Team"

__all__ = [
    "create_upload_router",
    "VerifyRequest",
    "VerifyResponse", 
    "UploadResponse",
    "MergeRequest",
    "MergeResponse",
    "UploadConfig",
] 