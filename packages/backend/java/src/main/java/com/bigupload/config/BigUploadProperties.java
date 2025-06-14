package com.bigupload.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * BigUpload配置属性
 */
@Data
@ConfigurationProperties(prefix = "bigupload")
public class BigUploadProperties {
    
    /**
     * 上传文件存储路径
     */
    private String uploadPath = "./uploads";
    
    /**
     * 临时文件存储路径
     */
    private String tempPath = "./uploads/temp";
    
    /**
     * 文件访问基础URL
     */
    private String baseUrl = "http://localhost:8080";
    
    /**
     * 最大文件大小（字节），0表示不限制
     */
    private long maxFileSize = 0;
    
    /**
     * 分片大小（字节）
     */
    private long chunkSize = 2 * 1024 * 1024; // 2MB
    
    /**
     * 并发上传数量
     */
    private int concurrent = 3;
    
    /**
     * API路径前缀
     */
    private String apiPrefix = "/api/upload";
    
    /**
     * 是否启用文件服务
     */
    private boolean enableFileServer = true;
    
    /**
     * 文件服务路径
     */
    private String fileServerPath = "/files";
} 