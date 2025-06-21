"""
Core upload service for BigUpload FastAPI package
"""

import os
import hashlib
import shutil
import aiofiles
from pathlib import Path
from typing import Dict, List, Set, Optional
from fastapi import UploadFile

from .config import UploadConfig
from .models import VerifyRequest, VerifyResponse, UploadResponse, MergeRequest, MergeResponse


class FileMetadata:
    """文件元数据类"""
    
    def __init__(self, file_id: str, file_name: str, file_hash: str, chunk_total: int):
        self.file_id = file_id
        self.file_name = file_name
        self.file_hash = file_hash
        self.chunk_total = chunk_total
        self.uploaded_chunks: Set[int] = set()
        self.status = "uploading"


class UploadService:
    """文件上传服务类"""
    
    def __init__(self, config: UploadConfig):
        self.config = config
        # 文件元数据存储（生产环境建议使用Redis或数据库）
        self._file_metadata: Dict[str, FileMetadata] = {}
        # 文件哈希到文件路径的映射（用于秒传）
        self._hash_to_file: Dict[str, str] = {}
    
    async def verify_file(self, request: VerifyRequest) -> VerifyResponse:
        """
        验证文件是否存在（秒传/断点续传）
        """
        # 检查是否有相同fileId的未完成上传
        if request.fileId in self._file_metadata:
            metadata = self._file_metadata[request.fileId]
            return VerifyResponse(
                fileId=request.fileId,
                exists=False,
                finish=False,
                uploadedChunks=list(metadata.uploaded_chunks),
                message="发现未完成的上传"
            )
        
        # 检查是否有相同fileHash的完成文件（秒传）
        file_extension = self._get_file_extension(request.fileName)
        target_filename = f"{request.fileHash}{file_extension}"
        target_path = self.config.get_upload_file_path(target_filename)
        
        if os.path.exists(target_path):
            file_url = self.config.get_file_url(target_filename)
            # 更新哈希映射
            self._hash_to_file[request.fileHash] = target_path
            return VerifyResponse(
                fileId=request.fileId,
                exists=True,
                finish=True,
                url=file_url,
                uploadedChunks=[],
                message="文件已存在，秒传成功"
            )
        
        # 检查是否有相同fileHash的未完成上传
        for metadata in self._file_metadata.values():
            if metadata.file_hash == request.fileHash and metadata.file_id != request.fileId:
                return VerifyResponse(
                    fileId=metadata.file_id,
                    exists=False,
                    finish=False,
                    uploadedChunks=list(metadata.uploaded_chunks),
                    message="发现相同哈希值的未完成上传"
                )
        
        # 没有找到任何相关文件
        return VerifyResponse(
            fileId=request.fileId,
            exists=False,
            finish=False,
            uploadedChunks=[],
            message="文件不存在，可以开始上传"
        )
    
    async def upload_chunk(
        self,
        chunk: UploadFile,
        file_id: str,
        file_name: str,
        chunk_index: int,
        chunk_total: int,
        file_hash: str,
        chunk_hash: Optional[str] = None
    ) -> UploadResponse:
        """
        上传分片
        """
        # 创建或获取文件元数据
        if file_id not in self._file_metadata:
            self._file_metadata[file_id] = FileMetadata(
                file_id=file_id,
                file_name=file_name,
                file_hash=file_hash,
                chunk_total=chunk_total
            )
        
        metadata = self._file_metadata[file_id]
        
        # 确保临时目录存在
        temp_dir_path = self.config.get_temp_dir_path(file_id)
        Path(temp_dir_path).mkdir(parents=True, exist_ok=True)
        
        # 保存分片文件
        chunk_file_path = self.config.get_chunk_file_path(file_id, chunk_index)
        async with aiofiles.open(chunk_file_path, 'wb') as f:
            content = await chunk.read()
            await f.write(content)
        
        # 验证分片哈希（如果提供）- 使用 SHA-256
        if chunk_hash:
            actual_hash = hashlib.sha256(content).hexdigest()
            if actual_hash != chunk_hash:
                # 删除错误的分片文件
                os.remove(chunk_file_path)
                raise ValueError(f"分片哈希验证失败: 期望 {chunk_hash}, 实际 {actual_hash}")
        
        # 更新元数据
        metadata.uploaded_chunks.add(chunk_index)
        
        return UploadResponse(
            fileId=file_id,
            chunkIndex=chunk_index,
            uploadedChunks=list(metadata.uploaded_chunks),
            message=f"分片 {chunk_index + 1}/{chunk_total} 上传成功"
        )
    
    async def merge_chunks(self, request: MergeRequest) -> MergeResponse:
        """
        合并分片
        """
        metadata = self._file_metadata.get(request.fileId)
        if not metadata:
            raise ValueError(f"未找到文件元数据: {request.fileId}")
        
        # 检查分片是否完整
        if len(metadata.uploaded_chunks) != request.chunkTotal:
            raise ValueError(
                f"分片不完整: {len(metadata.uploaded_chunks)}/{request.chunkTotal}"
            )
        
        # 检查所有分片是否存在
        for i in range(request.chunkTotal):
            if i not in metadata.uploaded_chunks:
                raise ValueError(f"缺少分片: {i}")
        
        # 生成目标文件路径
        file_extension = self._get_file_extension(request.fileName)
        target_filename = f"{request.fileHash}{file_extension}"
        target_path = self.config.get_upload_file_path(target_filename)
        
        # 合并分片
        await self._merge_chunk_files(request.fileId, target_path, request.chunkTotal)
        
        # 验证合并后的文件哈希
        actual_hash = await self._calculate_file_hash(target_path)
        if actual_hash != request.fileHash:
            # 删除错误的合并文件
            os.remove(target_path)
            raise ValueError(f"文件哈希验证失败: 期望 {request.fileHash}, 实际 {actual_hash}")
        
        # 清理临时文件
        await self._cleanup_temp_files(request.fileId)
        
        # 更新哈希映射
        self._hash_to_file[request.fileHash] = target_path
        
        # 清理元数据
        del self._file_metadata[request.fileId]
        
        file_url = self.config.get_file_url(target_filename)
        
        return MergeResponse(
            fileId=request.fileId,
            url=file_url,
            message="文件合并成功"
        )
    
    async def _merge_chunk_files(self, file_id: str, target_path: str, chunk_total: int):
        """使用aiofiles异步合并文件"""
        async with aiofiles.open(target_path, 'wb') as target_file:
            for i in range(chunk_total):
                chunk_file_path = self.config.get_chunk_file_path(file_id, i)
                if not os.path.exists(chunk_file_path):
                    raise ValueError(f"分片文件不存在: {chunk_file_path}")
                
                async with aiofiles.open(chunk_file_path, 'rb') as chunk_file:
                    content = await chunk_file.read()
                    await target_file.write(content)
    
    async def _calculate_file_hash(self, file_path: str) -> str:
        """异步计算文件SHA-256哈希"""
        hash_sha256 = hashlib.sha256()
        async with aiofiles.open(file_path, 'rb') as f:
            while chunk := await f.read(8192):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    async def _cleanup_temp_files(self, file_id: str):
        """清理临时文件"""
        temp_dir_path = self.config.get_temp_dir_path(file_id)
        if os.path.exists(temp_dir_path):
            shutil.rmtree(temp_dir_path, ignore_errors=True)
    
    def _get_file_extension(self, filename: str) -> str:
        """获取文件扩展名"""
        return os.path.splitext(filename)[1] if '.' in filename else ""
    
    def get_file_metadata(self, file_id: str) -> Optional[FileMetadata]:
        """获取文件元数据"""
        return self._file_metadata.get(file_id)
    
    def list_uploading_files(self) -> List[FileMetadata]:
        """列出正在上传的文件"""
        return list(self._file_metadata.values()) 