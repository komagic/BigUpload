3package com.bigupload.fastuploader;

/**
 * BigUpload Spring Boot Starter 主标识类
 * 
 * 这个类用于标识BigUpload Spring Boot Starter包
 * 当项目中包含这个类时，Spring Boot会自动加载相关的自动配置
 */
public class BigUploadStarter {
    
    /**
     * 版本信息
     */
    public static final String VERSION = "1.0.0";
    
    /**
     * 包名称
     */
    public static final String NAME = "BigUpload Spring Boot Starter";
    
    /**
     * 描述信息
     */
    public static final String DESCRIPTION = "企业级大文件上传 Spring Boot Starter，提供开箱即用的大文件上传功能";
    
    /**
     * 获取版本信息
     * @return 版本号
     */
    public static String getVersion() {
        return VERSION;
    }
    
    /**
     * 获取包信息
     * @return 包信息字符串
     */
    public static String getInfo() {
        return String.format("%s v%s - %s", NAME, VERSION, DESCRIPTION);
    }
} 