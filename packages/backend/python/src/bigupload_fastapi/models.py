"""
Pydantic models for BigUpload FastAPI package
"""

from typing import List, Optional
from pydantic import BaseModel


class VerifyRequest(BaseModel):
    """文件验证请求模型"""
    fileId: str
    fileName: str
    fileHash: str
    fileSize: Optional[int] = None
    chunkTotal: Optional[int] = None
    chunkSize: Optional[int] = None


class VerifyResponse(BaseModel):
    """文件验证响应模型"""
    success: bool = True
    fileId: str
    exists: bool
    finish: bool
    uploadedChunks: List[int] = []
    url: Optional[str] = None
    message: str


class UploadResponse(BaseModel):
    """分片上传响应模型"""
    success: bool = True
    fileId: str
    chunkIndex: int
    uploadedChunks: List[int] = []
    message: str


class MergeRequest(BaseModel):
    """分片合并请求模型"""
    fileId: str
    fileName: str
    fileHash: str
    chunkTotal: int
    fileSize: Optional[int] = None


class MergeResponse(BaseModel):
    """分片合并响应模型"""
    success: bool = True
    fileId: str
    url: str
    message: str


class ErrorResponse(BaseModel):
    """错误响应模型"""
    success: bool = False
    error: str
    message: str 