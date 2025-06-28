import request from "supertest";
import fs from "fs-extra";
import path from "path";

// 延迟导入app以确保环境变量已设置
let app: any;

beforeAll(async () => {
  app = require("../src/app").default || require("../src/app");
});

describe("Performance Tests", () => {
  describe("Concurrent Upload Tests", () => {
    it("should handle multiple concurrent chunk uploads", async () => {
      const concurrency = 5;
      const fileId = "concurrent-test";
      const fileName = "concurrent.txt";
      const fileHash = "concurrenthash123";
      const chunkTotal = concurrency;

      // 创建并发上传请求
      const uploadPromises = Array.from({ length: concurrency }, (_, index) => {
        const chunkData = Buffer.from(`chunk ${index} content`);

        return request(app)
          .post("/upload-chunk")
          .field("fileId", fileId)
          .field("fileName", fileName)
          .field("chunkIndex", index.toString())
          .field("chunkTotal", chunkTotal.toString())
          .field("fileHash", fileHash)
          .attach("chunk", chunkData, `chunk-${index}`)
          .expect(200);
      });

      // 等待所有上传完成
      const responses = await Promise.all(uploadPromises);

      // 验证所有上传都成功
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.fileId).toBe(fileId);
        expect(response.body.message).toContain(
          `分片 ${index}/${chunkTotal} 上传成功`
        );
      });

      // 验证最后一个请求标记为完成
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.body.completed).toBe(true);
    }, 60000); // 增加超时时间

    it("should handle concurrent verify requests", async () => {
      const concurrency = 10;
      const testData = {
        fileId: "concurrent-verify-test",
        fileHash: "concurrentverifyhash123",
        fileName: "verify-test.txt",
        fileSize: 1024,
      };

      // 创建并发验证请求
      const verifyPromises = Array.from({ length: concurrency }, () =>
        request(app).post("/verify").send(testData).expect(200)
      );

      // 等待所有请求完成
      const responses = await Promise.all(verifyPromises);

      // 验证所有响应都一致
      responses.forEach((response) => {
        expect(response.body).toMatchObject({
          success: true,
          exists: false,
          fileId: testData.fileId,
          uploadedChunks: [],
          message: "文件不存在",
          finish: false,
        });
      });
    }, 30000);
  });

  describe("Large File Tests", () => {
    it("should handle upload of many small chunks", async () => {
      const chunkCount = 20;
      const fileId = "large-file-test";
      const fileName = "large-file.txt";
      const fileHash = "largefilehash123";

      // 上传多个小分片
      for (let i = 0; i < chunkCount; i++) {
        const chunkData = Buffer.from(
          `chunk ${i.toString().padStart(3, "0")} `
        );

        await request(app)
          .post("/upload-chunk")
          .field("fileId", fileId)
          .field("fileName", fileName)
          .field("chunkIndex", i.toString())
          .field("chunkTotal", chunkCount.toString())
          .field("fileHash", fileHash)
          .attach("chunk", chunkData, `chunk-${i}`)
          .expect(200);
      }

      // 检查状态
      const statusResponse = await request(app)
        .get(`/status/${fileId}`)
        .expect(200);

      expect(statusResponse.body.uploadedChunks).toHaveLength(chunkCount);
      expect(statusResponse.body.chunkTotal).toBe(chunkCount);

      // 合并分片
      const mergeResponse = await request(app)
        .post("/merge-chunks")
        .send({
          fileId,
          fileName,
          fileHash,
          chunkTotal: chunkCount.toString(),
          fileSize: (chunkCount * 10).toString(), // 大概估算
        })
        .expect(200);

      expect(mergeResponse.body.success).toBe(true);
    }, 120000); // 2分钟超时

    it("should handle relatively large chunk size", async () => {
      const chunkSize = 10 * 1024 * 1024; // 10MB
      const fileId = "large-chunk-test";
      const fileName = "large-chunk.bin";
      const fileHash = "largechunkhash123";

      // 创建大分片
      const largeChunk = Buffer.alloc(chunkSize, "A");

      const response = await request(app)
        .post("/upload-chunk")
        .field("fileId", fileId)
        .field("fileName", fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", "1")
        .field("fileHash", fileHash)
        .attach("chunk", largeChunk, "large-chunk")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.completed).toBe(true);

      // 合并分片
      const mergeResponse = await request(app)
        .post("/merge-chunks")
        .send({
          fileId,
          fileName,
          fileHash,
          chunkTotal: "1",
          fileSize: chunkSize.toString(),
        })
        .expect(200);

      expect(mergeResponse.body.success).toBe(true);

      // 验证文件大小
      const uploadDir =
        process.env.UPLOAD_DIR || path.resolve(__dirname, "../test-uploads");
      const mergedFilePath = path.resolve(uploadDir, `${fileHash}.bin`);
      const stats = await fs.stat(mergedFilePath);
      expect(stats.size).toBe(chunkSize);
    }, 180000); // 3分钟超时
  });

  describe("Memory and Resource Tests", () => {
    it("should cleanup memory for completed uploads", async () => {
      const fileIds = ["memory-test-1", "memory-test-2", "memory-test-3"];

      // 创建多个文件上传
      for (const fileId of fileIds) {
        const chunkData = Buffer.from("memory test content");

        await request(app)
          .post("/upload-chunk")
          .field("fileId", fileId)
          .field("fileName", `${fileId}.txt`)
          .field("chunkIndex", "0")
          .field("chunkTotal", "1")
          .field("fileHash", `${fileId}hash`)
          .attach("chunk", chunkData, "chunk-0")
          .expect(200);

        // 合并分片（这应该清理元数据）
        await request(app)
          .post("/merge-chunks")
          .send({
            fileId,
            fileName: `${fileId}.txt`,
            fileHash: `${fileId}hash`,
            chunkTotal: "1",
            fileSize: chunkData.length.toString(),
          })
          .expect(200);

        // 验证元数据已被清理（状态查询应该返回404）
        await request(app).get(`/status/${fileId}`).expect(404);
      }
    });

    it("should handle cleanup of expired metadata", async () => {
      // 运行清理操作
      const cleanupResponse = await request(app).post("/cleanup").expect(200);

      expect(cleanupResponse.body.success).toBe(true);
      expect(typeof cleanupResponse.body.cleanedCount).toBe("number");
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle malformed requests gracefully", async () => {
      // 测试各种错误格式的请求
      const malformedRequests = [
        { endpoint: "/verify", data: { invalid: "data" } },
        { endpoint: "/upload-chunk", data: {} },
        { endpoint: "/merge-chunks", data: { incomplete: "data" } },
      ];

      for (const { endpoint, data } of malformedRequests) {
        const response = await request(app).post(endpoint).send(data);

        // 应该返回4xx错误，而不是5xx
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expect(response.body.success).toBe(false);
      }
    });

    it("should handle file system errors gracefully", async () => {
      // 测试不存在的文件ID的状态查询
      const response = await request(app)
        .get("/status/absolutely-non-existent-file-id")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "文件元数据不存在",
      });
    });

    it("should handle invalid file access", async () => {
      // 测试访问不存在的文件
      const response = await request(app)
        .get("/files/non-existent-file.txt")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "文件不存在",
      });
    });
  });

  describe("Rate Limiting Tests", () => {
    it("should handle rate limiting for upload chunks", async () => {
      // 创建大量并发请求来测试并发限制
      const concurrency = 15; // 超过 MAX_CONCURRENT_UPLOADS (10)
      const requests = Array.from({ length: concurrency }, (_, index) => {
        const chunkData = Buffer.from(`rate limit test ${index}`);

        return request(app)
          .post("/upload-chunk")
          .field("fileId", `rate-limit-test-${index}`)
          .field("fileName", "rate-limit.txt")
          .field("chunkIndex", "0")
          .field("chunkTotal", "1")
          .field("fileHash", `ratelimithash${index}`)
          .attach("chunk", chunkData, "chunk-0");
      });

      // 执行所有请求
      const responses = await Promise.allSettled(requests);

      // 检查是否有请求被限制
      const successCount = responses.filter(
        (result) => result.status === "fulfilled" && result.value.status === 200
      ).length;

      const rateLimitedCount = responses.filter(
        (result) => result.status === "fulfilled" && result.value.status === 429
      ).length;

      // 应该有一些请求成功，一些被限制
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(concurrency);

      // 验证被限制的请求返回正确的错误消息
      responses.forEach((result) => {
        if (result.status === "fulfilled" && result.value.status === 429) {
          expect(result.value.body).toMatchObject({
            success: false,
            message: "服务器繁忙，请稍后重试",
          });
        }
      });
    }, 60000);
  });
});
