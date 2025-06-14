package com.bigupload.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * 文件验证响应DTO
 */
@Data
@Builder
public class VerifyResponse {
    /**
     * 文件ID
     */
    private String fileId;
    
    /**
     * 文件是否已存在
     */
    private boolean exists;
    
    /**
     * 是否完成上传
     */
    private boolean finish;
    
    /**
     * 已上传的分片列表
     */
    private List<Integer> uploadedChunks;
    
    /**
     * 文件URL（如果文件已存在）
     */
    private String url;
    
    /**
     * 响应消息
     */
    private String message;
} 