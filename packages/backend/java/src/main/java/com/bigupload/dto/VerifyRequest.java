package com.bigupload.dto;

import lombok.Data;

/**
 * 文件验证请求DTO
 */
@Data
public class VerifyRequest {
    /**
     * 文件ID
     */
    private String fileId;
    
    /**
     * 文件名
     */
    private String fileName;
    
    /**
     * 文件哈希值
     */
    private String fileHash;
    
    /**
     * 文件大小
     */
    private Long fileSize;
    
    /**
     * 分片总数
     */
    private Integer chunkTotal;
    
    /**
     * 分片大小
     */
    private Long chunkSize;
} 