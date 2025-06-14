"""
BigUpload FastAPI Demo Application

这个应用展示了如何使用 bigupload-fastapi 包
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 导入 bigupload-fastapi 包
from bigupload_fastapi import create_upload_router

# 创建FastAPI应用
app = FastAPI(
    title="BigUpload FastAPI Demo",
    description="大文件上传 FastAPI 示例应用",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境中应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建并挂载上传路由
upload_router = create_upload_router(
    upload_path="./uploads",
    temp_path="./uploads/temp",
    base_url="http://localhost:8000",
    max_file_size=0,  # 0表示不限制文件大小
    chunk_size=2 * 1024 * 1024,  # 2MB分片大小
    concurrent=3,
    enable_file_server=True,
    file_server_path="/files"
)

app.include_router(upload_router, prefix="/api/upload")


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "BigUpload FastAPI Demo",
        "version": "1.0.0",
        "description": "大文件上传 FastAPI 示例应用",
        "endpoints": {
            "health": "/api/upload/health",
            "verify": "POST /api/upload/verify",
            "upload": "POST /api/upload/upload", 
            "merge": "POST /api/upload/merge",
            "status": "GET /api/upload/status/{file_id}",
            "list": "GET /api/upload/list",
            "files": "GET /files/{filename}"
        },
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy", "service": "BigUpload FastAPI Demo"}


if __name__ == "__main__":
    print("=" * 60)
    print("BigUpload FastAPI Demo 应用启动中...")
    print("=" * 60)
    print("访问地址:")
    print("  应用首页: http://localhost:8000")
    print("  API文档: http://localhost:8000/docs")
    print("  健康检查: http://localhost:8000/api/upload/health")
    print("")
    print("上传接口:")
    print("  POST /api/upload/verify   - 验证文件（秒传/断点续传）")
    print("  POST /api/upload/upload   - 上传分片")
    print("  POST /api/upload/merge    - 合并分片")
    print("  GET  /api/upload/status/{file_id} - 查询上传状态")
    print("  GET  /api/upload/list     - 列出正在上传的文件")
    print("  GET  /files/{filename}    - 下载文件")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 