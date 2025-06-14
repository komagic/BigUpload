package com.bigupload.dto;

import lombok.Builder;
import lombok.Data;

/**
 * 分片合并响应DTO
 */
@Data
@Builder
public class MergeResponse {
    /**
     * 文件ID
     */
    private String fileId;
    
    /**
     * 文件访问URL
     */
    private String url;
    
    /**
     * 响应消息
     */
    private String message;
} 