package com.bigupload.controller;

import com.bigupload.service.FileUploadService;
import com.bigupload.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * 大文件上传控制器
 * 提供统一的文件上传API接口
 */
@Slf4j
@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", maxAge = 3600)
public class FileUploadController {

    private final FileUploadService fileUploadService;

    /**
     * 验证文件是否存在（秒传/断点续传）
     * POST /verify
     */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyFile(@RequestBody VerifyRequest request) {
        log.info("验证文件请求: {}", request);
        
        try {
            VerifyResponse response = fileUploadService.verifyFile(request);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("exists", response.isExists());
            result.put("fileId", response.getFileId());
            result.put("uploadedChunks", response.getUploadedChunks());
            result.put("message", response.getMessage());
            result.put("finish", response.isFinish());
            
            if (response.getUrl() != null) {
                result.put("url", response.getUrl());
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("验证文件失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 上传单个分片
     * POST /upload
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadChunk(
            @RequestParam("chunk") MultipartFile chunk,
            @RequestParam("fileId") String fileId,
            @RequestParam("fileName") String fileName,
            @RequestParam("chunkIndex") Integer chunkIndex,
            @RequestParam("chunkTotal") Integer chunkTotal,
            @RequestParam("fileHash") String fileHash,
            @RequestParam(value = "chunkHash", required = false) String chunkHash,
            HttpServletRequest request) {
        
        log.info("上传分片请求: fileId={}, fileName={}, chunkIndex={}, chunkTotal={}", 
                fileId, fileName, chunkIndex, chunkTotal);
        
        try {
            UploadRequest uploadRequest = UploadRequest.builder()
                    .fileId(fileId)
                    .fileName(fileName)
                    .chunkIndex(chunkIndex)
                    .chunkTotal(chunkTotal)
                    .fileHash(fileHash)
                    .chunkHash(chunkHash)
                    .chunk(chunk)
                    .build();
            
            UploadResponse response = fileUploadService.uploadChunk(uploadRequest);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("fileId", response.getFileId());
            result.put("chunkIndex", response.getChunkIndex());
            result.put("uploadedChunks", response.getUploadedChunks());
            result.put("message", response.getMessage());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("上传分片失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 合并所有分片
     * POST /merge
     */
    @PostMapping("/merge")
    public ResponseEntity<Map<String, Object>> mergeChunks(@RequestBody MergeRequest request) {
        log.info("合并分片请求: {}", request);
        
        try {
            MergeResponse response = fileUploadService.mergeChunks(request);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("fileId", response.getFileId());
            result.put("url", response.getUrl());
            result.put("message", response.getMessage());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("合并分片失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "ok");
        result.put("service", "BigUpload Spring Boot Starter");
        result.put("version", "1.0.0");
        return ResponseEntity.ok(result);
    }
} 