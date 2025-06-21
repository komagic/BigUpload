package com.bigupload;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * BigUpload Spring Boot 应用启动类
 * 独立运行的上传服务应用
 */
@SpringBootApplication
public class Application {
    
    public static void main(String[] args) {
        System.out.println("=".repeat(60));
        System.out.println("🚀 BigUpload Java Backend 启动中...");
        System.out.println("=".repeat(60));
        System.out.println("访问地址:");
        System.out.println("  应用首页: http://localhost:8080/api/upload/");
        System.out.println("  健康检查: http://localhost:8080/api/upload/health");
        System.out.println("");
        System.out.println("上传接口:");
        System.out.println("  POST /api/upload/verify     - 验证文件（秒传/断点续传）");
        System.out.println("  POST /api/upload/upload-chunk - 上传分片");
        System.out.println("  POST /api/upload/merge-chunks - 合并分片");
        System.out.println("  GET  /api/upload/files/{filename} - 下载文件");
        System.out.println("=".repeat(60));
        
        SpringApplication.run(Application.class, args);
    }
} 