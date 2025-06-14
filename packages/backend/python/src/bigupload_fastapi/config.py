"""
Configuration class for BigUpload FastAPI package
"""

import os
from pathlib import Path
from typing import Optional


class UploadConfig:
    """上传配置类"""
    
    def __init__(
        self,
        upload_path: str = "./uploads",
        temp_path: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        max_file_size: int = 0,  # 0表示不限制
        chunk_size: int = 2 * 1024 * 1024,  # 2MB
        concurrent: int = 3,
        enable_file_server: bool = True,
        file_server_path: str = "/files"
    ):
        """
        初始化上传配置
        
        Args:
            upload_path: 上传文件存储路径
            temp_path: 临时文件存储路径（默认为 upload_path/temp）
            base_url: 文件访问基础URL
            max_file_size: 最大文件大小（字节），0表示不限制
            chunk_size: 分片大小（字节）
            concurrent: 并发上传数量
            enable_file_server: 是否启用文件服务
            file_server_path: 文件服务路径
        """
        self.upload_path = upload_path
        self.temp_path = temp_path or os.path.join(upload_path, "temp")
        self.base_url = base_url.rstrip("/")
        self.max_file_size = max_file_size
        self.chunk_size = chunk_size
        self.concurrent = concurrent
        self.enable_file_server = enable_file_server
        self.file_server_path = file_server_path
        
        # 确保目录存在
        self._ensure_directories()
    
    def _ensure_directories(self):
        """确保上传和临时目录存在"""
        Path(self.upload_path).mkdir(parents=True, exist_ok=True)
        Path(self.temp_path).mkdir(parents=True, exist_ok=True)
    
    def get_file_url(self, filename: str) -> str:
        """生成文件访问URL"""
        return f"{self.base_url}{self.file_server_path}/{filename}"
    
    def get_upload_file_path(self, filename: str) -> str:
        """获取上传文件的完整路径"""
        return os.path.join(self.upload_path, filename)
    
    def get_temp_dir_path(self, file_id: str) -> str:
        """获取临时目录路径"""
        return os.path.join(self.temp_path, file_id)
    
    def get_chunk_file_path(self, file_id: str, chunk_index: int) -> str:
        """获取分片文件路径"""
        return os.path.join(self.get_temp_dir_path(file_id), str(chunk_index))
    
    def __repr__(self):
        return (
            f"UploadConfig("
            f"upload_path='{self.upload_path}', "
            f"temp_path='{self.temp_path}', "
            f"base_url='{self.base_url}', "
            f"max_file_size={self.max_file_size}, "
            f"chunk_size={self.chunk_size}, "
            f"concurrent={self.concurrent})"
        ) 