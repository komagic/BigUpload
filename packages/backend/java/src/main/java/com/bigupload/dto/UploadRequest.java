package com.bigupload.dto;

import lombok.Builder;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

/**
 * 分片上传请求DTO
 */
@Data
@Builder
public class UploadRequest {
    /**
     * 文件ID
     */
    private String fileId;
    
    /**
     * 文件名
     */
    private String fileName;
    
    /**
     * 分片索引
     */
    private Integer chunkIndex;
    
    /**
     * 分片总数
     */
    private Integer chunkTotal;
    
    /**
     * 文件哈希值
     */
    private String fileHash;
    
    /**
     * 分片哈希值
     */
    private String chunkHash;
    
    /**
     * 分片文件
     */
    private MultipartFile chunk;
} 