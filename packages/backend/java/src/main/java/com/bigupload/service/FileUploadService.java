package com.bigupload.service;

import com.bigupload.config.BigUploadProperties;
import com.bigupload.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 文件上传服务
 * 核心业务逻辑：分片存储、文件合并、秒传验证
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileUploadService {

    private final BigUploadProperties properties;
    
    /**
     * 文件元数据存储（生产环境建议使用Redis或数据库）
     */
    private final Map<String, FileMetadata> fileMetadataMap = new ConcurrentHashMap<>();
    
    /**
     * 文件哈希到文件路径的映射（用于秒传）
     */
    private final Map<String, String> hashToFileMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        // 确保上传目录存在
        File uploadDir = new File(properties.getUploadPath());
        File tempDir = new File(properties.getTempPath());
        
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
            log.info("创建上传目录: {}", uploadDir.getAbsolutePath());
        }
        
        if (!tempDir.exists()) {
            tempDir.mkdirs();
            log.info("创建临时目录: {}", tempDir.getAbsolutePath());
        }
    }

    /**
     * 验证文件是否存在（秒传/断点续传）
     */
    public VerifyResponse verifyFile(VerifyRequest request) {
        log.info("验证文件: fileId={}, fileHash={}, fileName={}", 
                request.getFileId(), request.getFileHash(), request.getFileName());

        // 检查是否有相同fileId的未完成上传
        FileMetadata metadata = fileMetadataMap.get(request.getFileId());
        if (metadata != null) {
            log.info("找到相同fileId的未完成上传: {}", request.getFileId());
            return VerifyResponse.builder()
                    .fileId(request.getFileId())
                    .exists(false)
                    .finish(false)
                    .uploadedChunks(new ArrayList<>(metadata.getUploadedChunks()))
                    .message("发现未完成的上传")
                    .build();
        }

        // 检查是否有相同fileHash的完成文件（秒传）
        String existingFilePath = hashToFileMap.get(request.getFileHash());
        if (existingFilePath != null && new File(existingFilePath).exists()) {
            log.info("找到相同fileHash的文件，支持秒传: {}", request.getFileHash());
            String fileUrl = generateFileUrl(existingFilePath);
            return VerifyResponse.builder()
                    .fileId(request.getFileId())
                    .exists(true)
                    .finish(true)
                    .url(fileUrl)
                    .uploadedChunks(Collections.emptyList())
                    .message("文件已存在，秒传成功")
                    .build();
        }

        // 检查是否有相同fileHash的未完成上传
        for (FileMetadata meta : fileMetadataMap.values()) {
            if (request.getFileHash().equals(meta.getFileHash()) && 
                !request.getFileId().equals(meta.getFileId())) {
                log.info("找到相同fileHash的未完成上传: {}", meta.getFileId());
                return VerifyResponse.builder()
                        .fileId(meta.getFileId())
                        .exists(false)
                        .finish(false)
                        .uploadedChunks(new ArrayList<>(meta.getUploadedChunks()))
                        .message("发现相同哈希值的未完成上传")
                        .build();
            }
        }

        // 没有找到任何相关文件
        log.info("未找到文件: {}", request.getFileId());
        return VerifyResponse.builder()
                .fileId(request.getFileId())
                .exists(false)
                .finish(false)
                .uploadedChunks(Collections.emptyList())
                .message("文件不存在，可以开始上传")
                .build();
    }

    /**
     * 上传分片
     */
    public UploadResponse uploadChunk(UploadRequest request) throws IOException {
        log.info("上传分片: fileId={}, chunkIndex={}, chunkTotal={}", 
                request.getFileId(), request.getChunkIndex(), request.getChunkTotal());

        // 创建文件元数据
        FileMetadata metadata = fileMetadataMap.computeIfAbsent(request.getFileId(), k -> {
            FileMetadata meta = new FileMetadata();
            meta.setFileId(request.getFileId());
            meta.setFileName(request.getFileName());
            meta.setFileHash(request.getFileHash());
            meta.setChunkTotal(request.getChunkTotal());
            meta.setUploadedChunks(new HashSet<>());
            return meta;
        });

        // 创建分片存储目录
        Path chunkDir = Paths.get(properties.getTempPath(), request.getFileId());
        File chunkDirFile = chunkDir.toFile();
        if (!chunkDirFile.exists()) {
            chunkDirFile.mkdirs();
        }

        // 保存分片文件
        Path chunkPath = chunkDir.resolve(String.valueOf(request.getChunkIndex()));
        request.getChunk().transferTo(chunkPath);
        
        // 更新元数据
        metadata.getUploadedChunks().add(request.getChunkIndex());
        
        log.info("分片上传成功: fileId={}, chunkIndex={}, 已上传: {}/{}", 
                request.getFileId(), request.getChunkIndex(), 
                metadata.getUploadedChunks().size(), request.getChunkTotal());

        return UploadResponse.builder()
                .fileId(request.getFileId())
                .chunkIndex(request.getChunkIndex())
                .uploadedChunks(new ArrayList<>(metadata.getUploadedChunks()))
                .message("分片上传成功")
                .build();
    }

    /**
     * 合并分片
     */
    public MergeResponse mergeChunks(MergeRequest request) throws IOException {
        log.info("合并分片: fileId={}, fileName={}, chunkTotal={}", 
                request.getFileId(), request.getFileName(), request.getChunkTotal());

        FileMetadata metadata = fileMetadataMap.get(request.getFileId());
        if (metadata == null) {
            throw new IllegalArgumentException("未找到文件元数据: " + request.getFileId());
        }

        // 检查分片是否完整
        if (metadata.getUploadedChunks().size() != request.getChunkTotal()) {
            throw new IllegalStateException(String.format("分片不完整: %d/%d", 
                    metadata.getUploadedChunks().size(), request.getChunkTotal()));
        }

        // 生成目标文件路径
        String fileExtension = getFileExtension(request.getFileName());
        String targetFileName = request.getFileHash() + fileExtension;
        Path targetPath = Paths.get(properties.getUploadPath(), targetFileName);
        
        // 合并分片
        mergeChunkFiles(request.getFileId(), targetPath, request.getChunkTotal());
        
        // 清理临时文件
        cleanupTempFiles(request.getFileId());
        
        // 更新哈希映射
        hashToFileMap.put(request.getFileHash(), targetPath.toString());
        
        // 清理元数据
        fileMetadataMap.remove(request.getFileId());
        
        String fileUrl = generateFileUrl(targetPath.toString());
        log.info("文件合并成功: fileId={}, url={}", request.getFileId(), fileUrl);

        return MergeResponse.builder()
                .fileId(request.getFileId())
                .url(fileUrl)
                .message("文件合并成功")
                .build();
    }

    /**
     * 使用FileChannel高效合并文件
     */
    private void mergeChunkFiles(String fileId, Path targetPath, int chunkTotal) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(targetPath.toFile());
             FileChannel targetChannel = fos.getChannel()) {
            
            Path chunkDir = Paths.get(properties.getTempPath(), fileId);
            
            for (int i = 0; i < chunkTotal; i++) {
                Path chunkPath = chunkDir.resolve(String.valueOf(i));
                File chunkFile = chunkPath.toFile();
                
                if (!chunkFile.exists()) {
                    throw new IOException("分片文件不存在: " + chunkPath);
                }
                
                try (FileInputStream fis = new FileInputStream(chunkFile);
                     FileChannel chunkChannel = fis.getChannel()) {
                    targetChannel.transferFrom(chunkChannel, targetChannel.position(), chunkChannel.size());
                }
            }
        }
    }

    /**
     * 清理临时文件
     */
    private void cleanupTempFiles(String fileId) {
        try {
            Path chunkDir = Paths.get(properties.getTempPath(), fileId);
            File chunkDirFile = chunkDir.toFile();
            if (chunkDirFile.exists()) {
                FileUtils.deleteDirectory(chunkDirFile);
                log.info("清理临时目录: {}", chunkDir);
            }
        } catch (IOException e) {
            log.warn("清理临时文件失败: {}", fileId, e);
        }
    }

    /**
     * 生成文件访问URL
     */
    private String generateFileUrl(String filePath) {
        Path path = Paths.get(filePath);
        String fileName = path.getFileName().toString();
        return properties.getBaseUrl() + "/files/" + fileName;
    }

    /**
     * 获取文件扩展名
     */
    private String getFileExtension(String fileName) {
        int lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";
    }

    /**
     * 文件元数据内部类
     */
    private static class FileMetadata {
        private String fileId;
        private String fileName;
        private String fileHash;
        private Integer chunkTotal;
        private Set<Integer> uploadedChunks;

        // Getters and Setters
        public String getFileId() { return fileId; }
        public void setFileId(String fileId) { this.fileId = fileId; }
        
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        
        public String getFileHash() { return fileHash; }
        public void setFileHash(String fileHash) { this.fileHash = fileHash; }
        
        public Integer getChunkTotal() { return chunkTotal; }
        public void setChunkTotal(Integer chunkTotal) { this.chunkTotal = chunkTotal; }
        
        public Set<Integer> getUploadedChunks() { return uploadedChunks; }
        public void setUploadedChunks(Set<Integer> uploadedChunks) { this.uploadedChunks = uploadedChunks; }
    }
} 