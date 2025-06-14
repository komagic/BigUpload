import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import multer from "multer";
import crypto from "crypto";
import SparkMD5 from "spark-md5";
import dotenv from "dotenv";

// 加载配置
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 上传目录
const UPLOAD_DIR = path.resolve(__dirname, "../uploads");
const TEMP_DIR = path.resolve(UPLOAD_DIR, "temp");

// 确保目录存在
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(TEMP_DIR);

// 文件元数据存储（实际生产环境应使用数据库）
const fileMetadata: Record<string, any> = {};

// 配置multer用于处理文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 使用临时目录存储上传的文件
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    // 生成唯一的文件名
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload = multer({ storage });

// 路由
app.get("/", (req, res) => {
  res.json({
    name: "FastUploader Node.js Backend",
    version: "1.0.0",
    status: "running",
  });
});

// 验证文件是否已存在（秒传功能）
app.post("/verify", async (req, res) => {
  try {
    const { fileId, fileHash, fileName, fileSize } = req.body;

    if (!fileHash || !fileName || !fileId) {
      return res.status(400).json({
        success: false,
        message: "参数不完整",
      });
    }

    console.log("验证文件请求参数:", { fileId, fileHash, fileName, fileSize });

    // 首先检查是否有相同fileId的未完成上传
    if (fileMetadata[fileId]) {
      console.log(`找到相同fileId的未完成上传: ${fileId}`);
      return res.json({
        success: true,
        exists: false,
        fileId: fileId,
        uploadedChunks: fileMetadata[fileId].uploadedChunks || [],
        message: "发现未完成的上传",
        finish: false,
      });
    }

    // 然后检查是否有相同fileHash的文件
    // 获取文件扩展名
    const ext = path.extname(fileName);
    const targetFilename = `${fileHash}${ext}`;
    const targetPath = path.resolve(UPLOAD_DIR, targetFilename);

    // 检查文件是否存在
    if (await fs.pathExists(targetPath)) {
      console.log(`找到相同fileHash的文件: ${fileHash}`);
      const fileUrl = `/files/${targetFilename}`;
      return res.json({
        success: true,
        exists: true,
        fileId: fileId,
        url: fileUrl,
        message: "文件已存在",
        finish: true,
      });
    }

    // 检查是否有相同fileHash的未完成上传
    for (const [fid, metadata] of Object.entries(fileMetadata)) {
      if (metadata.fileHash === fileHash && fid !== fileId) {
        console.log(`找到相同fileHash的未完成上传: ${fid}`);
        return res.json({
          success: true,
          exists: false,
          fileId: fid,
          uploadedChunks: metadata.uploadedChunks || [],
          message: "发现相同哈希值的未完成上传",
          finish: false,
        });
      }
    }

    // 没有找到文件
    console.log(`未找到文件: ${fileId}, ${fileHash}`);
    return res.json({
      success: true,
      exists: false,
      fileId: fileId,
      uploadedChunks: [],
      message: "文件不存在",
      finish: false,
    });
  } catch (error) {
    console.error("验证文件错误:", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "服务器错误",
    });
  }
});

// 上传分片
app.post("/upload-chunk", upload.single("chunk"), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "没有找到文件分片",
      });
    }

    const { fileId, fileName, chunkIndex, chunkTotal, fileHash } = req.body;
    console.log("接收到分片上传请求:", {
      fileId,
      fileName,
      chunkIndex,
      chunkTotal,
      fileHash,
    });
    console.log(`chunkIndex类型: ${typeof chunkIndex}, 值: ${chunkIndex}`);

    if (!fileId || !fileName || !fileHash) {
      return res.status(400).json({
        success: false,
        message: "参数不完整",
      });
    }

    // 确保文件目录存在
    const fileDir = path.resolve(TEMP_DIR, fileId);
    fs.ensureDirSync(fileDir);

    // 移动文件到正确的位置
    const chunkIndexStr = chunkIndex.toString();
    console.log(
      `将chunkIndex转换为字符串: ${chunkIndexStr}, 类型: ${typeof chunkIndexStr}`
    );

    const targetPath = path.resolve(fileDir, chunkIndexStr);
    console.log(`目标路径: ${targetPath}`);

    await fs.move(file.path, targetPath, { overwrite: true });
    console.log(`文件已移动到: ${targetPath}`);

    // 更新文件元数据
    if (!fileMetadata[fileId]) {
      fileMetadata[fileId] = {
        fileName,
        fileHash,
        chunkTotal: parseInt(chunkTotal),
        uploadedChunks: [],
      };
    }

    // 添加已上传的分片索引
    const chunkIdx = parseInt(chunkIndex);
    console.log(
      `将chunkIndex解析为整数: ${chunkIdx}, 类型: ${typeof chunkIdx}`
    );

    if (!fileMetadata[fileId].uploadedChunks.includes(chunkIdx)) {
      fileMetadata[fileId].uploadedChunks.push(chunkIdx);
    }

    console.log(
      `当前已上传分片: ${fileMetadata[fileId].uploadedChunks.join(", ")}`
    );

    // 检查是否所有分片都已上传完成
    const allChunksUploaded =
      fileMetadata[fileId].uploadedChunks.length === parseInt(chunkTotal);

    console.log(
      `分片 ${chunkIndex} 上传成功，已上传 ${fileMetadata[fileId].uploadedChunks.length}/${chunkTotal} 个分片`
    );
    console.log(`所有分片是否已上传完成: ${allChunksUploaded}`);

    return res.json({
      success: true,
      fileId,
      message: `分片 ${chunkIndex}/${chunkTotal} 上传成功`,
      completed: allChunksUploaded, // 添加标志表示是否所有分片都已上传完成
    });
  } catch (error) {
    console.error("上传分片错误:", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "服务器错误",
    });
  }
});

// 合并分片
app.post("/merge-chunks", async (req, res) => {
  try {
    const { fileId, fileName, fileHash, chunkTotal, fileSize } = req.body;

    if (!fileId || !fileName || !fileHash || !chunkTotal) {
      return res.status(400).json({
        success: false,
        message: "参数不完整",
      });
    }

    console.log(
      `开始合并文件: ${fileName}, 文件ID: ${fileId}, 哈希: ${fileHash}`
    );

    // 获取文件元数据
    const metadata = fileMetadata[fileId];
    if (!metadata) {
      return res.status(404).json({
        success: false,
        message: "文件元数据不存在",
      });
    }

    // 检查所有分片是否已上传
    const uploadedChunks = metadata.uploadedChunks;
    const expectedChunkTotal = parseInt(chunkTotal);

    console.log(`已上传分片: ${uploadedChunks.length}/${expectedChunkTotal}`);
    console.log(`已上传分片索引:`, uploadedChunks);

    if (uploadedChunks.length !== expectedChunkTotal) {
      return res.status(400).json({
        success: false,
        message: `分片不完整: ${uploadedChunks.length}/${expectedChunkTotal}`,
      });
    }

    // 获取文件扩展名
    const ext = path.extname(fileName);
    const targetFilename = `${fileHash}${ext}`;
    const targetPath = path.resolve(UPLOAD_DIR, targetFilename);

    // 检查目标文件是否已存在（可能是并发请求）
    if (await fs.pathExists(targetPath)) {
      console.log(`文件已存在: ${targetPath}`);
      const fileUrl = `/files/${targetFilename}`;

      // 清理临时文件夹
      const fileDir = path.resolve(TEMP_DIR, fileId);
      await fs.remove(fileDir);

      return res.json({
        success: true,
        fileId,
        url: fileUrl,
        message: "文件已存在，无需合并",
      });
    }

    // 合并文件
    const fileDir = path.resolve(TEMP_DIR, fileId);
    const writeStream = fs.createWriteStream(targetPath);

    console.log(`开始合并分片，目标路径: ${targetPath}`);

    // 按顺序合并所有分片 - 从0开始
    for (let i = 0; i < expectedChunkTotal; i++) {
      const chunkPath = path.resolve(fileDir, i.toString());
      if (await fs.pathExists(chunkPath)) {
        console.log(`合并分片 ${i}/${expectedChunkTotal - 1}`);
        const chunkBuffer = await fs.readFile(chunkPath);
        writeStream.write(chunkBuffer);
      } else {
        // 如果有分片丢失，返回错误
        writeStream.close();
        await fs.remove(targetPath);
        return res.status(400).json({
          success: false,
          message: `分片${i}丢失，请重新上传`,
        });
      }
    }

    // 完成写入
    writeStream.end();

    // 等待文件写入完成
    await new Promise<void>((resolve) => {
      writeStream.on("finish", () => {
        resolve();
      });
    });

    console.log(`文件写入完成，开始验证文件哈希`);

    // 验证合并后的文件大小
    const stats = await fs.stat(targetPath);
    if (fileSize && stats.size !== parseInt(fileSize)) {
      console.error(`文件大小不匹配: 期望=${fileSize}, 实际=${stats.size}`);
      await fs.remove(targetPath);
      return res.status(400).json({
        success: false,
        message: "文件大小验证失败",
      });
    }

    // 验证合并后的文件哈希
    try {
      const mergedFileBuffer = await fs.readFile(targetPath);

      // 使用SparkMD5计算哈希，保持与前端一致，确保计算方式匹配
      const spark = new SparkMD5.ArrayBuffer();

      // 分块计算文件哈希，与前端保持一致
      const chunkSize = 2 * 1024 * 1024; // 2MB，与前端保持一致
      const totalChunks = Math.ceil(mergedFileBuffer.length / chunkSize);

      console.log(
        `开始计算文件哈希，分块大小: ${chunkSize}字节, 总块数: ${totalChunks}`
      );

      // 分块处理大文件
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, mergedFileBuffer.length);
        const chunk = mergedFileBuffer.slice(start, end);

        spark.append(chunk);
      }

      const calculatedHash = spark.end();

      // 哈希不匹配，删除合并的文件
      if (calculatedHash !== fileHash) {
        console.error(`哈希验证失败: 期望=${fileHash}, 实际=${calculatedHash}`);
        await fs.remove(targetPath);
        return res.status(400).json({
          success: false,
          message: "文件哈希验证失败",
        });
      }

      console.log(`文件哈希验证成功: ${calculatedHash}`);
    } catch (error) {
      console.error("哈希验证过程中出错:", error);
      await fs.remove(targetPath);
      return res.status(500).json({
        success: false,
        message: "文件哈希验证过程出错",
      });
    }

    // 清理临时文件夹
    await fs.remove(fileDir);

    // 删除文件元数据
    delete fileMetadata[fileId];

    const fileUrl = `/files/${targetFilename}`;
    return res.json({
      success: true,
      fileId,
      url: fileUrl,
      message: "文件合并成功",
    });
  } catch (error) {
    console.error("合并文件错误:", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "服务器错误",
    });
  }
});

// 提供上传的文件访问
app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.resolve(UPLOAD_DIR, filename);

  // 检查文件是否存在
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({
      success: false,
      message: "文件不存在",
    });
  }

  res.sendFile(filepath);
});

// 启动服务
app.listen(port, () => {
  console.log(`FastUploader Node.js 后端服务运行在 http://localhost:${port}`);
});
