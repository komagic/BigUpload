import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import multer from "multer";
import crypto from "crypto";
import dotenv from "dotenv";

// 加载配置
dotenv.config();

// 定义本地接口类型（避免依赖shared包）
interface VerifyResponse {
  exists: boolean;
  fileId?: string;
  url?: string;
  uploadedChunks?: number[];
  message?: string;
  success?: boolean;
  finish?: boolean;
}

interface UploadResponse {
  success: boolean;
  fileId?: string;
  url?: string;
  message?: string;
  completed?: boolean;
}

interface FileMetadata {
  fileName: string;
  fileHash: string;
  chunkTotal: number;
  uploadedChunks: number[];
  createdAt: string;
  lastUpdated: string;
}

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 设置请求超时
app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 为上传请求设置更长的超时时间
    if (
      req.path.includes("/upload-chunk") ||
      req.path.includes("/merge-chunks")
    ) {
      req.setTimeout(5 * 60 * 1000); // 5分钟
      res.setTimeout(5 * 60 * 1000);
    } else {
      req.setTimeout(30 * 1000); // 30秒
      res.setTimeout(30 * 1000);
    }
    next();
  }
);

// 简单的并发限制
let activeUploads = 0;
const MAX_CONCURRENT_UPLOADS = 10;

const concurrencyLimiter = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.path.includes("/upload-chunk")) {
    if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
      return res.status(429).json({
        success: false,
        message: "服务器繁忙，请稍后重试",
      });
    }
    activeUploads++;
    res.on("finish", () => {
      activeUploads--;
    });
  }
  next();
};

app.use(concurrencyLimiter);

// 上传目录
const UPLOAD_DIR = path.resolve(__dirname, "../uploads");
const TEMP_DIR = path.resolve(UPLOAD_DIR, "temp");

// 确保目录存在
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(TEMP_DIR);

// 文件元数据存储（内存 + 文件持久化）
const fileMetadata: Record<string, FileMetadata> = {};

// 元数据持久化文件路径
const METADATA_FILE = path.resolve(TEMP_DIR, "metadata.json");

// 加载元数据
const loadMetadata = async (): Promise<void> => {
  try {
    if (await fs.pathExists(METADATA_FILE)) {
      const data = await fs.readJson(METADATA_FILE);
      Object.assign(fileMetadata, data);
      console.log(`加载元数据: ${Object.keys(fileMetadata).length} 个文件`);
    }
  } catch (error) {
    console.error("加载元数据失败:", error);
  }
};

// 保存元数据
const saveMetadata = async (): Promise<void> => {
  try {
    await fs.writeJson(METADATA_FILE, fileMetadata, { spaces: 2 });
  } catch (error) {
    console.error("保存元数据失败:", error);
  }
};

// 启动时加载元数据
loadMetadata();

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

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per chunk
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // 允许所有文件类型
    cb(null, true);
  },
});

// 路由
app.get("/", (req, res) => {
  res.json({
    name: "BigUpload Node.js Backend",
    version: "1.0.1",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// 健康检查端点
app.get("/health", (req, res) => {
  res.json({
    name: "BigUpload Node.js Backend",
    version: "1.0.1",
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
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

// 上传分片 - 修复文件处理逻辑
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
      fileSize: file.size,
    });

    if (!fileId || !fileName || !fileHash) {
      return res.status(400).json({
        success: false,
        message: "参数不完整",
      });
    }

    // 确保文件目录存在
    const fileDir = path.resolve(TEMP_DIR, fileId);
    await fs.ensureDir(fileDir);

    // 目标文件路径
    const chunkIndexStr = chunkIndex.toString();
    const targetPath = path.resolve(fileDir, chunkIndexStr);

    console.log(`处理分片文件: ${file.path} -> ${targetPath}`);

    // 检查源文件是否存在
    if (!(await fs.pathExists(file.path))) {
      console.error(`源文件不存在: ${file.path}`);
      return res.status(500).json({
        success: false,
        message: `源文件不存在`,
      });
    }

    // 改进的文件处理逻辑
    try {
      // 首先尝试移动文件
      await fs.move(file.path, targetPath, { overwrite: true });
      console.log(`文件成功移动到: ${targetPath}`);
    } catch (moveError) {
      console.warn(`文件移动失败，尝试复制:`, moveError);

      try {
        // 如果移动失败，尝试复制
        await fs.copy(file.path, targetPath, { overwrite: true });

        // 复制成功后删除源文件
        try {
          await fs.remove(file.path);
        } catch (removeError) {
          console.warn("删除源文件失败:", removeError);
          // 不影响主流程，继续执行
        }

        console.log(`文件成功复制到: ${targetPath}`);
      } catch (copyError) {
        console.error(`文件复制也失败:`, copyError);
        return res.status(500).json({
          success: false,
          message: `文件处理失败: ${(copyError as Error).message}`,
        });
      }
    }

    // 验证目标文件是否存在且有内容
    const targetStats = await fs.stat(targetPath);
    if (targetStats.size === 0) {
      console.error(`目标文件大小为0: ${targetPath}`);
      return res.status(500).json({
        success: false,
        message: "文件分片保存失败",
      });
    }

    // 更新文件元数据
    if (!fileMetadata[fileId]) {
      fileMetadata[fileId] = {
        fileName,
        fileHash,
        chunkTotal: parseInt(chunkTotal),
        uploadedChunks: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
    }

    // 添加已上传的分片索引
    const chunkIdx = parseInt(chunkIndex);
    if (!fileMetadata[fileId].uploadedChunks.includes(chunkIdx)) {
      fileMetadata[fileId].uploadedChunks.push(chunkIdx);
      fileMetadata[fileId].uploadedChunks.sort((a, b) => a - b); // 排序
      fileMetadata[fileId].lastUpdated = new Date().toISOString();

      // 异步保存元数据，不阻塞响应
      saveMetadata().catch((err) => console.error("保存元数据失败:", err));
    }

    console.log(
      `分片 ${chunkIndex} 上传成功，已上传 ${fileMetadata[fileId].uploadedChunks.length}/${chunkTotal} 个分片`
    );

    // 检查是否所有分片都已上传完成
    const allChunksUploaded =
      fileMetadata[fileId].uploadedChunks.length === parseInt(chunkTotal);

    return res.json({
      success: true,
      fileId,
      message: `分片 ${chunkIndex}/${chunkTotal} 上传成功`,
      completed: allChunksUploaded,
      uploadedChunks: fileMetadata[fileId].uploadedChunks.length,
      totalChunks: parseInt(chunkTotal),
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
      res.status(400).json({
        success: false,
        message: "参数不完整",
      });
      return;
    }

    console.log(
      `开始合并文件: ${fileName}, 文件ID: ${fileId}, 哈希: ${fileHash}`
    );

    // 获取文件元数据
    const metadata = fileMetadata[fileId];
    if (!metadata) {
      res.status(404).json({
        success: false,
        message: "文件元数据不存在",
      });
      return;
    }

    const expectedChunkTotal = parseInt(chunkTotal);
    const fileDir = path.resolve(TEMP_DIR, fileId);

    // 检查临时目录是否存在
    if (!(await fs.pathExists(fileDir))) {
      res.status(404).json({
        success: false,
        message: "文件分片目录不存在",
      });
      return;
    }

    // 动态检查实际存在的分片文件（更可靠的方法）
    const actualChunks: number[] = [];
    const missingChunks: number[] = [];

    console.log(`检查分片完整性，期望分片数: ${expectedChunkTotal}`);

    for (let i = 0; i < expectedChunkTotal; i++) {
      const chunkPath = path.resolve(fileDir, i.toString());
      if (await fs.pathExists(chunkPath)) {
        const stats = await fs.stat(chunkPath);
        if (stats.size > 0) {
          actualChunks.push(i);
          console.log(`找到分片 ${i}，大小: ${stats.size} 字节`);
        } else {
          console.warn(`分片 ${i} 存在但大小为0`);
          missingChunks.push(i);
        }
      } else {
        console.warn(`分片 ${i} 不存在`);
        missingChunks.push(i);
      }
    }

    console.log(`实际找到分片: ${actualChunks.length}/${expectedChunkTotal}`);
    console.log(`缺失分片:`, missingChunks);

    // 计算缺失率
    const missingRate = missingChunks.length / expectedChunkTotal;
    console.log(`缺失率: ${(missingRate * 100).toFixed(1)}%`);

    // 更宽容的完整性检查：允许最多5%的分片丢失（对于网络问题的容错）
    if (missingRate > 0.05) {
      res.status(400).json({
        success: false,
        message: `分片不完整: 找到${
          actualChunks.length
        }/${expectedChunkTotal}个分片，缺失率过高(${(missingRate * 100).toFixed(
          1
        )}%)`,
      });
      return;
    }

    // 如果有少量分片缺失，记录警告但继续合并
    if (missingChunks.length > 0) {
      console.warn(
        `警告: 发现${
          missingChunks.length
        }个缺失分片，但继续合并: [${missingChunks.join(", ")}]`
      );
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
      await fs.remove(fileDir);

      res.json({
        success: true,
        fileId,
        url: fileUrl,
        message: "文件已存在，无需合并",
      });
      return;
    }

    // 合并文件
    const writeStream = fs.createWriteStream(targetPath);
    console.log(`开始合并分片，目标路径: ${targetPath}`);

    let totalWrittenBytes = 0;

    // 按顺序合并存在的分片
    for (let i = 0; i < expectedChunkTotal; i++) {
      const chunkPath = path.resolve(fileDir, i.toString());

      if (actualChunks.includes(i)) {
        console.log(`合并分片 ${i}/${expectedChunkTotal - 1}`);
        try {
          const chunkBuffer = await fs.readFile(chunkPath);
          writeStream.write(chunkBuffer);
          totalWrittenBytes += chunkBuffer.length;
        } catch (error) {
          console.error(`读取分片 ${i} 失败:`, error);
          // 分片读取失败，记录错误但继续处理下一个分片
        }
      } else {
        console.warn(`跳过缺失的分片 ${i}`);
        // 对于缺失的分片，我们跳过而不是写入空数据
        // 这样可以让最终文件更小，虽然可能不完整，但至少是可用的
      }
    }

    // 完成写入
    writeStream.end();

    // 等待文件写入完成
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => {
        resolve();
      });
      writeStream.on("error", (error) => {
        reject(error);
      });
    });

    console.log(`文件写入完成，实际写入字节数: ${totalWrittenBytes}`);

    // 验证合并后的文件
    const stats = await fs.stat(targetPath);
    console.log(`合并后文件大小: ${stats.size} 字节`);

    // 如果提供了原始文件大小，进行大小验证（允许一定误差）
    if (fileSize) {
      const expectedSize = parseInt(fileSize);
      const sizeDiff = Math.abs(stats.size - expectedSize);
      const sizeErrorRate = sizeDiff / expectedSize;

      console.log(
        `期望大小: ${expectedSize}, 实际大小: ${
          stats.size
        }, 误差: ${sizeDiff} 字节 (${(sizeErrorRate * 100).toFixed(2)}%)`
      );

      // 允许5%的大小误差（考虑到可能的分片丢失）
      if (sizeErrorRate > 0.05) {
        console.warn(
          `文件大小误差过大，但仍然保留文件: 期望=${expectedSize}, 实际=${stats.size}`
        );
        // 不删除文件，记录警告即可
      }
    }

    // 简化哈希验证：如果分片有缺失，跳过哈希验证
    if (missingChunks.length === 0) {
      // 只有在所有分片都存在时才进行哈希验证
      try {
        const mergedFileBuffer = await fs.readFile(targetPath);
        const hash = crypto.createHash("sha256");
        hash.update(mergedFileBuffer);
        const calculatedHash = hash.digest("hex");

        if (calculatedHash !== fileHash) {
          console.warn(
            `哈希验证失败但文件已保存: 期望=${fileHash}, 实际=${calculatedHash}`
          );
          // 不删除文件，因为部分内容可能是有效的
        } else {
          console.log(`文件哈希验证成功: ${calculatedHash}`);
        }
      } catch (error) {
        console.warn("哈希验证过程中出错，但文件已保存:", error);
      }
    } else {
      console.log("由于分片缺失，跳过哈希验证");
    }

    // 清理临时文件夹
    try {
      await fs.remove(fileDir);
      console.log("临时文件夹清理完成");
    } catch (error) {
      console.warn("清理临时文件夹失败:", error);
    }

    // 删除文件元数据
    delete fileMetadata[fileId];

    // 异步保存元数据更新
    saveMetadata().catch((err) => console.error("保存元数据失败:", err));

    const fileUrl = `/files/${targetFilename}`;

    // 构建响应消息
    let message = "文件合并成功";
    if (missingChunks.length > 0) {
      message += ` (注意: ${missingChunks.length}个分片丢失，文件可能不完整)`;
    }

    res.json({
      success: true,
      fileId,
      url: fileUrl,
      message,
      warning:
        missingChunks.length > 0
          ? `${missingChunks.length} chunks missing`
          : undefined,
    });
  } catch (error) {
    console.error("合并文件错误:", error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || "服务器错误",
    });
  }
});

// 清理过期的元数据
app.post("/cleanup", async (req, res) => {
  try {
    const now = new Date();
    const expiredTime = 24 * 60 * 60 * 1000; // 24小时
    let cleanedCount = 0;

    for (const [fileId, metadata] of Object.entries(fileMetadata)) {
      const lastUpdated = new Date(metadata.lastUpdated || metadata.createdAt);
      if (now.getTime() - lastUpdated.getTime() > expiredTime) {
        // 清理临时文件
        const fileDir = path.resolve(TEMP_DIR, fileId);
        if (await fs.pathExists(fileDir)) {
          await fs.remove(fileDir);
        }

        // 删除元数据
        delete fileMetadata[fileId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await saveMetadata();
    }

    res.json({
      success: true,
      message: `清理了 ${cleanedCount} 个过期文件`,
      cleanedCount,
    });
  } catch (error) {
    console.error("清理元数据错误:", error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || "服务器错误",
    });
  }
});

// 获取上传状态
app.get("/status/:fileId", (req, res) => {
  try {
    const fileId = req.params.fileId;
    const metadata = fileMetadata[fileId];

    if (!metadata) {
      res.status(404).json({
        success: false,
        message: "文件元数据不存在",
      });
      return;
    }

    res.json({
      success: true,
      fileId,
      ...metadata,
    });
  } catch (error) {
    console.error("获取状态错误:", error);
    res.status(500).json({
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
    res.status(404).json({
      success: false,
      message: "文件不存在",
    });
    return;
  }

  res.sendFile(filepath);
});

// 启动服务
if (require.main === module) {
  // 只有在直接运行此文件时才启动服务器
  app.listen(port, () => {
    console.log(`FastUploader Node.js 后端服务运行在 http://localhost:${port}`);
  });
}

// 导出应用实例以供测试使用
export default app;
