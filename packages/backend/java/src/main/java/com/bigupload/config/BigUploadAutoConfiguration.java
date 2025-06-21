package com.bigupload.config;

import com.bigupload.controller.FileUploadController;
import com.bigupload.service.FileUploadService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.multipart.MultipartResolver;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * BigUpload自动配置类
 * Spring Boot Starter的核心，提供自动配置功能
 */
@Slf4j
@Configuration
@ConditionalOnClass({FileUploadController.class, FileUploadService.class})
@EnableConfigurationProperties(BigUploadProperties.class)
public class BigUploadAutoConfiguration implements WebMvcConfigurer {

    private final BigUploadProperties properties;

    public BigUploadAutoConfiguration(BigUploadProperties properties) {
        this.properties = properties;
        log.info("BigUpload自动配置初始化, 配置: {}", properties);
    }

    /**
     * 文件上传服务Bean
     */
    @Bean
    @ConditionalOnMissingBean
    public FileUploadService fileUploadService() {
        log.info("创建FileUploadService Bean");
        return new FileUploadService(properties);
    }

    /**
     * 文件上传控制器Bean
     */
    @Bean
    @ConditionalOnMissingBean
    public FileUploadController fileUploadController(FileUploadService fileUploadService) {
        log.info("创建FileUploadController Bean");
        return new FileUploadController(fileUploadService, properties);
    }

    /**
     * 多部分文件解析器
     */
    @Bean
    @ConditionalOnMissingBean(MultipartResolver.class)
    public MultipartResolver multipartResolver() {
        log.info("创建MultipartResolver Bean");
        return new StandardServletMultipartResolver();
    }

    /**
     * 静态资源处理器配置
     * 提供文件下载服务
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if (properties.isEnableFileServer()) {
            String uploadPath = properties.getUploadPath();
            if (!uploadPath.endsWith("/")) {
                uploadPath += "/";
            }
            
            registry.addResourceHandler(properties.getFileServerPath() + "/**")
                    .addResourceLocations("file:" + uploadPath);
            
            log.info("配置文件服务器: {} -> file:{}", properties.getFileServerPath(), uploadPath);
        }
    }

    /**
     * 配置检查Bean
     * 在启动时打印配置信息
     */
    @Bean
    @ConditionalOnProperty(prefix = "bigupload", name = "enabled", havingValue = "true", matchIfMissing = true)
    public BigUploadConfigChecker configChecker() {
        return new BigUploadConfigChecker(properties);
    }

    /**
     * 配置检查器内部类
     */
    public static class BigUploadConfigChecker {
        
        public BigUploadConfigChecker(BigUploadProperties properties) {
            log.info("=== BigUpload Spring Boot Starter 配置信息 ===");
            log.info("上传路径: {}", properties.getUploadPath());
            log.info("临时路径: {}", properties.getTempPath());
            log.info("基础URL: {}", properties.getBaseUrl());
            log.info("最大文件大小: {} bytes (0=不限制)", properties.getMaxFileSize());
            log.info("分片大小: {} bytes", properties.getChunkSize());
            log.info("并发数: {}", properties.getConcurrent());
            log.info("API前缀: {}", properties.getApiPrefix());
            log.info("文件服务: {} (路径: {})", 
                    properties.isEnableFileServer() ? "启用" : "禁用", 
                    properties.getFileServerPath());
            log.info("=== BigUpload 配置完成 ===");
        }
    }
} 