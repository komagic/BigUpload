"""
FastAPI router for BigUpload package
"""

import logging
from typing import Optional
from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import UploadConfig
from .service import UploadService
from .models import VerifyRequest, VerifyResponse, UploadResponse, MergeRequest, MergeResponse, ErrorResponse

logger = logging.getLogger(__name__)


def create_upload_router(
    upload_path: str = "./uploads",
    temp_path: Optional[str] = None,
    base_url: str = "http://localhost:8000",
    max_file_size: int = 0,
    chunk_size: int = 2 * 1024 * 1024,
    concurrent: int = 3,
    enable_file_server: bool = True,
    file_server_path: str = "/files",
    config: Optional[UploadConfig] = None
) -> APIRouter:
    """
    创建上传路由器
    
    Args:
        upload_path: 上传文件存储路径
        temp_path: 临时文件存储路径
        base_url: 文件访问基础URL
        max_file_size: 最大文件大小（字节）
        chunk_size: 分片大小（字节）
        concurrent: 并发上传数量
        enable_file_server: 是否启用文件服务
        file_server_path: 文件服务路径
        config: 自定义配置对象（如果提供则忽略其他参数）
        
    Returns:
        FastAPI APIRouter 实例
    """
    
    # 使用自定义配置或创建新配置
    if config is None:
        config = UploadConfig(
            upload_path=upload_path,
            temp_path=temp_path,
            base_url=base_url,
            max_file_size=max_file_size,
            chunk_size=chunk_size,
            concurrent=concurrent,
            enable_file_server=enable_file_server,
            file_server_path=file_server_path
        )
    
    # 创建上传服务实例
    upload_service = UploadService(config)
    
    # 创建路由器
    router = APIRouter(
        tags=["BigUpload"],
        responses={
            400: {"model": ErrorResponse, "description": "请求参数错误"},
            500: {"model": ErrorResponse, "description": "服务器内部错误"}
        }
    )
    
    logger.info(f"创建BigUpload路由器: {config}")
    
    @router.post("/verify", response_model=VerifyResponse, summary="验证文件是否存在")
    async def verify_file(request: VerifyRequest):
        """
        验证文件是否存在（秒传/断点续传）
        
        - **fileId**: 文件唯一标识符
        - **fileName**: 文件名
        - **fileHash**: 文件MD5哈希值
        - **fileSize**: 文件大小（可选）
        - **chunkTotal**: 分片总数（可选）
        """
        try:
            logger.info(f"验证文件请求: fileId={request.fileId}, fileHash={request.fileHash}")
            response = await upload_service.verify_file(request)
            logger.info(f"验证结果: exists={response.exists}, finish={response.finish}")
            return response
        except Exception as e:
            logger.error(f"验证文件失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/upload", response_model=UploadResponse, summary="上传文件分片")
    async def upload_chunk(
        chunk: UploadFile = File(..., description="分片文件"),
        fileId: str = Form(..., description="文件ID"),
        fileName: str = Form(..., description="文件名"),
        chunkIndex: int = Form(..., description="分片索引"),
        chunkTotal: int = Form(..., description="分片总数"),
        fileHash: str = Form(..., description="文件哈希值"),
        chunkHash: Optional[str] = Form(None, description="分片哈希值")
    ):
        """
        上传单个分片
        
        - **chunk**: 分片文件数据
        - **fileId**: 文件唯一标识符
        - **fileName**: 文件名
        - **chunkIndex**: 分片索引（从0开始）
        - **chunkTotal**: 分片总数
        - **fileHash**: 文件MD5哈希值
        - **chunkHash**: 分片MD5哈希值（可选，用于验证）
        """
        try:
            logger.info(f"上传分片: fileId={fileId}, chunkIndex={chunkIndex}/{chunkTotal}")
            
            # 检查文件大小限制
            if config.max_file_size > 0 and chunk.size and chunk.size > config.max_file_size:
                raise HTTPException(
                    status_code=400, 
                    detail=f"分片大小超过限制: {chunk.size} > {config.max_file_size}"
                )
            
            response = await upload_service.upload_chunk(
                chunk=chunk,
                file_id=fileId,
                file_name=fileName,
                chunk_index=chunkIndex,
                chunk_total=chunkTotal,
                file_hash=fileHash,
                chunk_hash=chunkHash
            )
            
            logger.info(f"分片上传成功: chunkIndex={chunkIndex}, 已上传: {len(response.uploadedChunks)}/{chunkTotal}")
            return response
            
        except ValueError as e:
            logger.warning(f"上传分片参数错误: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"上传分片失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/merge", response_model=MergeResponse, summary="合并文件分片")
    async def merge_chunks(request: MergeRequest):
        """
        合并所有分片
        
        - **fileId**: 文件唯一标识符
        - **fileName**: 文件名
        - **fileHash**: 文件MD5哈希值
        - **chunkTotal**: 分片总数
        - **fileSize**: 文件大小（可选）
        """
        try:
            logger.info(f"合并分片请求: fileId={request.fileId}, chunkTotal={request.chunkTotal}")
            
            response = await upload_service.merge_chunks(request)
            
            logger.info(f"文件合并成功: fileId={request.fileId}, url={response.url}")
            return response
            
        except ValueError as e:
            logger.warning(f"合并分片参数错误: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"合并分片失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/health", summary="健康检查")
    async def health_check():
        """健康检查接口"""
        return {
            "status": "ok",
            "service": "BigUpload FastAPI Package",
            "version": "1.0.0",
            "config": {
                "upload_path": config.upload_path,
                "temp_path": config.temp_path,
                "max_file_size": config.max_file_size,
                "chunk_size": config.chunk_size,
                "concurrent": config.concurrent,
                "enable_file_server": config.enable_file_server
            }
        }
    
    @router.get("/status/{file_id}", summary="查询文件上传状态")
    async def get_upload_status(file_id: str):
        """查询指定文件的上传状态"""
        metadata = upload_service.get_file_metadata(file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return {
            "fileId": metadata.file_id,
            "fileName": metadata.file_name,
            "fileHash": metadata.file_hash,
            "chunkTotal": metadata.chunk_total,
            "uploadedChunks": list(metadata.uploaded_chunks),
            "progress": len(metadata.uploaded_chunks) / metadata.chunk_total * 100,
            "status": metadata.status
        }
    
    @router.get("/list", summary="列出正在上传的文件")
    async def list_uploading_files():
        """列出所有正在上传的文件"""
        files = upload_service.list_uploading_files()
        return [
            {
                "fileId": metadata.file_id,
                "fileName": metadata.file_name,
                "fileHash": metadata.file_hash,
                "chunkTotal": metadata.chunk_total,
                "uploadedChunks": len(metadata.uploaded_chunks),
                "progress": len(metadata.uploaded_chunks) / metadata.chunk_total * 100,
                "status": metadata.status
            }
            for metadata in files
        ]
    
    # 如果启用文件服务，添加静态文件路由
    if config.enable_file_server:
        @router.get(f"{config.file_server_path}/{{filename}}", summary="下载文件")
        async def download_file(filename: str):
            """下载上传的文件"""
            file_path = config.get_upload_file_path(filename)
            try:
                return FileResponse(
                    path=file_path,
                    filename=filename,
                    media_type='application/octet-stream'
                )
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail="文件不存在")
    
    return router 