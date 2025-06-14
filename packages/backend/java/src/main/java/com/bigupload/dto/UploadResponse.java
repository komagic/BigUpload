package com.bigupload.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * 分片上传响应DTO
 */
@Data
@Builder
public class UploadResponse {
    /**
     * 文件ID
     */
    private String fileId;
    
    /**
     * 分片索引
     */
    private Integer chunkIndex;
    
    /**
     * 已上传的分片列表
     */
    private List<Integer> uploadedChunks;
    
    /**
     * 响应消息
     */
    private String message;
} 