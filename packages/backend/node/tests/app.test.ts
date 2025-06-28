import request from "supertest";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

// 延迟导入app以确保环境变量已设置
let app: any;

beforeAll(async () => {
  // 确保在设置环境变量后再导入app
  app = require("../src/app").default || require("../src/app");
});

describe("BigUpload Node.js Backend", () => {
  describe("GET /", () => {
    it("should return basic info", async () => {
      const response = await request(app).get("/").expect(200);

      expect(response.body).toMatchObject({
        name: "FastUploader Node.js Backend",
        version: "1.0.0",
        status: "running",
      });
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toMatchObject({
        name: "FastUploader Node.js Backend",
        version: "1.0.0",
        status: "running",
      });
    });
  });

  describe("POST /verify", () => {
    it("should return file not exists for new file", async () => {
      const testData = {
        fileId: "test-file-id-1",
        fileHash: "abcd1234",
        fileName: "test.txt",
        fileSize: 1024,
      };

      const response = await request(app)
        .post("/verify")
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        exists: false,
        fileId: testData.fileId,
        uploadedChunks: [],
        message: "文件不存在",
        finish: false,
      });
    });

    it("should return error for missing parameters", async () => {
      const response = await request(app).post("/verify").send({}).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "参数不完整",
      });
    });

    it("should detect existing file", async () => {
      const testFileHash = "existingfilehash123";
      const testFileName = "existing.txt";
      const testContent = "This is a test file";

      // 创建测试文件
      const uploadDir =
        process.env.UPLOAD_DIR || path.resolve(__dirname, "../test-uploads");
      const targetFilename = `${testFileHash}.txt`;
      const targetPath = path.resolve(uploadDir, targetFilename);
      await fs.writeFile(targetPath, testContent);

      const testData = {
        fileId: "test-file-id-2",
        fileHash: testFileHash,
        fileName: testFileName,
        fileSize: testContent.length,
      };

      const response = await request(app)
        .post("/verify")
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        exists: true,
        fileId: testData.fileId,
        message: "文件已存在",
        finish: true,
      });

      expect(response.body.url).toBe(`/files/${targetFilename}`);

      // 清理测试文件
      await fs.remove(targetPath);
    });
  });

  describe("POST /upload-chunk", () => {
    it("should upload chunk successfully", async () => {
      const testData = {
        fileId: "test-chunk-upload-1",
        fileName: "test-chunk.txt",
        chunkIndex: "0",
        chunkTotal: "2",
        fileHash: "testchunkhash123",
      };

      const chunkData = Buffer.from("chunk 0 content");

      const response = await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", testData.chunkIndex)
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunkData, "chunk-0")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        fileId: testData.fileId,
        completed: false,
      });

      expect(response.body.message).toContain("分片 0/2 上传成功");
    });

    it("should return error for missing chunk file", async () => {
      const testData = {
        fileId: "test-chunk-upload-2",
        fileName: "test-chunk.txt",
        chunkIndex: "0",
        chunkTotal: "2",
        fileHash: "testchunkhash456",
      };

      const response = await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", testData.chunkIndex)
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "没有找到文件分片",
      });
    });

    it("should return error for missing parameters", async () => {
      const chunkData = Buffer.from("test content");

      const response = await request(app)
        .post("/upload-chunk")
        .attach("chunk", chunkData, "chunk-0")
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "参数不完整",
      });
    });

    it("should handle multiple chunks upload", async () => {
      const testData = {
        fileId: "test-multi-chunk-1",
        fileName: "test-multi.txt",
        chunkTotal: "3",
        fileHash: "multichunkhash123",
      };

      // 上传第一个分片
      const chunk0 = Buffer.from("chunk 0 ");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk0, "chunk-0")
        .expect(200);

      // 上传第二个分片
      const chunk1 = Buffer.from("chunk 1 ");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "1")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk1, "chunk-1")
        .expect(200);

      // 上传最后一个分片
      const chunk2 = Buffer.from("chunk 2");
      const response = await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "2")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk2, "chunk-2")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        fileId: testData.fileId,
        completed: true,
      });
    });
  });

  describe("POST /merge-chunks", () => {
    it("should merge chunks successfully", async () => {
      const testData = {
        fileId: "test-merge-1",
        fileName: "test-merge.txt",
        fileHash: "mergehash123",
        chunkTotal: "2",
        fileSize: "18",
      };

      // 先上传分片
      const chunk0 = Buffer.from("chunk 0 ");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk0, "chunk-0")
        .expect(200);

      const chunk1 = Buffer.from("content");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "1")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk1, "chunk-1")
        .expect(200);

      // 合并分片
      const response = await request(app)
        .post("/merge-chunks")
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        fileId: testData.fileId,
        message: "文件合并成功",
      });

      expect(response.body.url).toBe(`/files/${testData.fileHash}.txt`);

      // 验证合并后的文件内容
      const uploadDir =
        process.env.UPLOAD_DIR || path.resolve(__dirname, "../test-uploads");
      const mergedFilePath = path.resolve(
        uploadDir,
        `${testData.fileHash}.txt`
      );
      const mergedContent = await fs.readFile(mergedFilePath, "utf8");
      expect(mergedContent).toBe("chunk 0 content");
    });

    it("should return error for missing parameters", async () => {
      const response = await request(app)
        .post("/merge-chunks")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "参数不完整",
      });
    });

    it("should return error for non-existent metadata", async () => {
      const testData = {
        fileId: "non-existent-file",
        fileName: "test.txt",
        fileHash: "nonexistenthash",
        chunkTotal: "2",
      };

      const response = await request(app)
        .post("/merge-chunks")
        .send(testData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "文件元数据不存在",
      });
    });

    it("should handle incomplete chunks gracefully", async () => {
      const testData = {
        fileId: "test-incomplete-1",
        fileName: "test-incomplete.txt",
        fileHash: "incompletehash123",
        chunkTotal: "3",
        fileSize: "27",
      };

      // 只上传部分分片
      const chunk0 = Buffer.from("chunk 0 ");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk0, "chunk-0")
        .expect(200);

      // 跳过分片1，直接上传分片2
      const chunk2 = Buffer.from("chunk 2");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "2")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk2, "chunk-2")
        .expect(200);

      // 合并分片（应该成功但有警告）
      const response = await request(app)
        .post("/merge-chunks")
        .send(testData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.warning).toBeDefined();
      expect(response.body.message).toContain("分片丢失");
    });
  });

  describe("GET /status/:fileId", () => {
    it("should return file status", async () => {
      const testData = {
        fileId: "test-status-1",
        fileName: "test-status.txt",
        chunkTotal: "2",
        fileHash: "statushash123",
      };

      // 上传一个分片
      const chunk0 = Buffer.from("status test");
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", chunk0, "chunk-0")
        .expect(200);

      // 查询状态
      const response = await request(app)
        .get(`/status/${testData.fileId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        fileId: testData.fileId,
        fileName: testData.fileName,
        fileHash: testData.fileHash,
        chunkTotal: 2,
        uploadedChunks: [0],
      });
    });

    it("should return 404 for non-existent file", async () => {
      const response = await request(app)
        .get("/status/non-existent-file")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "文件元数据不存在",
      });
    });
  });

  describe("POST /cleanup", () => {
    it("should cleanup expired metadata", async () => {
      const response = await request(app).post("/cleanup").expect(200);

      expect(response.body).toMatchObject({
        success: true,
      });

      expect(response.body.message).toContain("清理了");
      expect(typeof response.body.cleanedCount).toBe("number");
    });
  });

  describe("GET /files/:filename", () => {
    it("should serve uploaded file", async () => {
      const testContent = "This is a test file for serving";
      const testFilename = "serve-test.txt";

      // 创建测试文件
      const uploadDir =
        process.env.UPLOAD_DIR || path.resolve(__dirname, "../test-uploads");
      const testFilePath = path.resolve(uploadDir, testFilename);
      await fs.writeFile(testFilePath, testContent);

      const response = await request(app)
        .get(`/files/${testFilename}`)
        .expect(200);

      expect(response.text).toBe(testContent);

      // 清理测试文件
      await fs.remove(testFilePath);
    });

    it("should return 404 for non-existent file", async () => {
      const response = await request(app)
        .get("/files/non-existent-file.txt")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "文件不存在",
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete upload workflow", async () => {
      const testData = {
        fileId: "integration-test-1",
        fileName: "integration.txt",
        chunkTotal: "3",
        fileHash: "integrationhash123",
      };

      // 1. 验证文件不存在
      const verifyResponse = await request(app)
        .post("/verify")
        .send({
          fileId: testData.fileId,
          fileHash: testData.fileHash,
          fileName: testData.fileName,
          fileSize: 24,
        })
        .expect(200);

      expect(verifyResponse.body.exists).toBe(false);

      // 2. 上传所有分片
      const chunks = ["chunk 0 ", "chunk 1 ", "chunk 2"];
      for (let i = 0; i < chunks.length; i++) {
        await request(app)
          .post("/upload-chunk")
          .field("fileId", testData.fileId)
          .field("fileName", testData.fileName)
          .field("chunkIndex", i.toString())
          .field("chunkTotal", testData.chunkTotal)
          .field("fileHash", testData.fileHash)
          .attach("chunk", Buffer.from(chunks[i]), `chunk-${i}`)
          .expect(200);
      }

      // 3. 检查上传状态
      const statusResponse = await request(app)
        .get(`/status/${testData.fileId}`)
        .expect(200);

      expect(statusResponse.body.uploadedChunks).toEqual([0, 1, 2]);

      // 4. 合并分片
      const mergeResponse = await request(app)
        .post("/merge-chunks")
        .send({
          ...testData,
          fileSize: "24",
        })
        .expect(200);

      expect(mergeResponse.body.success).toBe(true);

      // 5. 验证合并后的文件
      const fileResponse = await request(app)
        .get(mergeResponse.body.url)
        .expect(200);

      expect(fileResponse.text).toBe("chunk 0 chunk 1 chunk 2");

      // 6. 再次验证文件存在（秒传测试）
      const verifyAgainResponse = await request(app)
        .post("/verify")
        .send({
          fileId: "new-file-id",
          fileHash: testData.fileHash,
          fileName: testData.fileName,
          fileSize: 24,
        })
        .expect(200);

      expect(verifyAgainResponse.body.exists).toBe(true);
      expect(verifyAgainResponse.body.finish).toBe(true);
    });

    it("should handle file hash validation", async () => {
      const originalContent = "This is the original content";
      const hash = crypto.createHash("sha256");
      hash.update(originalContent);
      const correctHash = hash.digest("hex");

      const testData = {
        fileId: "hash-validation-test",
        fileName: "hash-test.txt",
        chunkTotal: "1",
        fileHash: correctHash,
      };

      // 上传分片
      await request(app)
        .post("/upload-chunk")
        .field("fileId", testData.fileId)
        .field("fileName", testData.fileName)
        .field("chunkIndex", "0")
        .field("chunkTotal", testData.chunkTotal)
        .field("fileHash", testData.fileHash)
        .attach("chunk", Buffer.from(originalContent), "chunk-0")
        .expect(200);

      // 合并分片
      const mergeResponse = await request(app)
        .post("/merge-chunks")
        .send({
          ...testData,
          fileSize: originalContent.length.toString(),
        })
        .expect(200);

      expect(mergeResponse.body.success).toBe(true);
      expect(mergeResponse.body.message).toBe("文件合并成功");
    });
  });
});
