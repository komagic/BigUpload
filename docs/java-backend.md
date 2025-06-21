# Java 后端 - Spring Boot Starter

## 🚀 快速开始

### 添加依赖

**Maven**:
```xml
<dependency>
    <groupId>com.bigupload</groupId>
    <artifactId>bigupload-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

**Gradle**:
```gradle
implementation 'com.bigupload:bigupload-spring-boot-starter:1.0.0'
```

### 配置文件

**application.yml**:
```yaml
bigupload:
  upload-path: ./uploads
  temp-path: ./uploads/temp
  base-url: http://localhost:8080
  max-file-size: 0  # 0 = 不限制
  chunk-size: 2097152  # 2MB
  concurrent: 3
  enable-file-server: true
  file-server-path: /files

server:
  port: 8080

spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 100MB
```

### 启动应用

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

就这样！🎉 大文件上传服务已就绪。

## 📡 API 端点

- **健康检查**: `GET /api/upload/health`
- **文件验证**: `POST /api/upload/verify`
- **分片上传**: `POST /api/upload/upload-chunk`
- **分片合并**: `POST /api/upload/merge-chunks`
- **文件下载**: `GET /api/upload/files/{filename}`

---

[返回主文档](../README.md) 