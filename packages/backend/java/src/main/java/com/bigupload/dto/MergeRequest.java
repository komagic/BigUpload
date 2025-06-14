package com.bigupload.dto;

import lombok.Data;

/**
 * 分片合并请求DTO
 */
@Data
public class MergeRequest {
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
     * 分片总数
     */
    private Integer chunkTotal;
    
    /**
     * 文件大小
     */
    private Long fileSize;
} 