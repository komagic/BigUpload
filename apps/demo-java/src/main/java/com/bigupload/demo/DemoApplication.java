package com.bigupload.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.HashMap;
import java.util.Map;

/**
 * BigUpload Java 演示应用
 * 
 * 演示如何使用 BigUpload Spring Boot Starter
 */
@SpringBootApplication
@RestController
public class DemoApplication {

    public static void main(String[] args) {
        System.out.println("=".repeat(60));
        System.out.println("BigUpload Java Demo 应用启动中...");
        System.out.println("=".repeat(60));
        
        SpringApplication.run(DemoApplication.class, args);
        
        System.out.println("访问地址:");
        System.out.println("  应用首页: http://localhost:8080");
        System.out.println("  健康检查: http://localhost:8080/api/upload/health");
        System.out.println("  Swagger文档: http://localhost:8080/swagger-ui.html");
        System.out.println("");
        System.out.println("上传接口:");
        System.out.println("  POST /api/upload/verify   - 验证文件（秒传/断点续传）");
        System.out.println("  POST /api/upload/upload   - 上传分片");
        System.out.println("  POST /api/upload/merge    - 合并分片");
        System.out.println("  GET  /files/{filename}    - 下载文件");
        System.out.println("=".repeat(60));
    }

    /**
     * CORS 配置
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .maxAge(3600);
            }
        };
    }

    /**
     * 应用首页
     */
    @GetMapping("/")
    public Map<String, Object> home() {
        Map<String, Object> result = new HashMap<>();
        result.put("name", "BigUpload Java Demo");
        result.put("version", "1.0.0");
        result.put("description", "大文件上传 Spring Boot 示例应用");
        
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("health", "GET /api/upload/health");
        endpoints.put("verify", "POST /api/upload/verify");
        endpoints.put("upload", "POST /api/upload/upload");
        endpoints.put("merge", "POST /api/upload/merge");
        endpoints.put("files", "GET /files/{filename}");
        result.put("endpoints", endpoints);
        
        return result;
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "healthy");
        result.put("service", "BigUpload Java Demo");
        result.put("timestamp", System.currentTimeMillis());
        return result;
    }
} 