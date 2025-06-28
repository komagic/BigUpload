import fs from "fs-extra";
import path from "path";

// 测试环境设置
process.env.NODE_ENV = "test";
process.env.PORT = "3001"; // 使用不同的端口避免冲突

// 测试用的上传目录
const TEST_UPLOAD_DIR = path.resolve(__dirname, "../test-uploads");
const TEST_TEMP_DIR = path.resolve(TEST_UPLOAD_DIR, "temp");

// 确保测试目录存在
beforeAll(async () => {
  await fs.ensureDir(TEST_UPLOAD_DIR);
  await fs.ensureDir(TEST_TEMP_DIR);

  // 设置环境变量
  process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
  process.env.TEMP_DIR = TEST_TEMP_DIR;
});

// 清理测试目录
afterAll(async () => {
  try {
    await fs.remove(TEST_UPLOAD_DIR);
  } catch (error) {
    console.warn("清理测试目录失败:", error);
  }
});

// 每个测试后清理临时文件
afterEach(async () => {
  try {
    // 清理临时目录但保留目录结构
    const tempFiles = await fs.readdir(TEST_TEMP_DIR);
    for (const file of tempFiles) {
      const filePath = path.join(TEST_TEMP_DIR, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.remove(filePath);
      } else if (file !== ".gitkeep") {
        await fs.remove(filePath);
      }
    }
  } catch (error) {
    // 忽略清理错误
  }
});
