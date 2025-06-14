package com.bigupload.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * BigUpload Java Demo 应用
 * 
 * 这个应用展示了如何使用 bigupload-spring-boot-starter
 */
@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
        System.out.println("BigUpload Java Demo 应用已启动!");
        System.out.println("访问 http://localhost:8080/api/upload/health 查看健康状态");
        System.out.println("上传接口:");
        System.out.println("  POST /api/upload/verify   - 验证文件");
        System.out.println("  POST /api/upload/upload   - 上传分片");
        System.out.println("  POST /api/upload/merge    - 合并分片");
    }
} 