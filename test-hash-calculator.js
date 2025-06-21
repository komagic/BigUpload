// 测试不同文件类型的哈希计算 - 使用 SHA-256
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 创建测试目录
const TEST_DIR = path.resolve(__dirname, "test-files");
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// 测试文件路径
const testFiles = {
  text: path.resolve(TEST_DIR, "test.txt"),
  pdf: path.resolve(TEST_DIR, "test.pdf"),
  image: path.resolve(TEST_DIR, "test.jpg"),
  video: path.resolve(TEST_DIR, "test.mp4"),
};

// 创建测试文件
function createTestFiles() {
  // 创建文本文件
  fs.writeFileSync(testFiles.text, "Hello, this is a test file.");

  // 创建简单的PDF文件 (不是有效的PDF，仅用于测试)
  fs.writeFileSync(
    testFiles.pdf,
    "%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\n%%EOF"
  );

  // 创建简单的图像文件 (不是有效的JPG，仅用于测试)
  const imageData = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  ]);
  fs.writeFileSync(testFiles.image, imageData);

  // 创建简单的视频文件 (不是有效的MP4，仅用于测试)
  const videoData = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  ]);
  fs.writeFileSync(testFiles.video, videoData);
}

// 使用Node.js的crypto计算文件哈希 - SHA-256
function calculateHashWithCrypto(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

// 使用原生 crypto 计算文件哈希 (同步版本)
function calculateHashWithNativeCrypto(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256");
      hash.update(fileBuffer);
      resolve(hash.digest("hex"));
    } catch (err) {
      reject(err);
    }
  });
}

// 使用原生 crypto 分块计算文件哈希 (模拟前端分块计算)
function calculateHashWithNativeCryptoChunked(
  filePath,
  chunkSize = 2 * 1024 * 1024
) {
  return new Promise((resolve, reject) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256");
      const chunks = Math.ceil(fileBuffer.length / chunkSize);

      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileBuffer.length);
        const chunk = fileBuffer.slice(start, end);
        hash.update(chunk);
      }

      resolve(hash.digest("hex"));
    } catch (err) {
      reject(err);
    }
  });
}

// 运行测试
async function runTests() {
  console.log("创建测试文件...");
  createTestFiles();

  console.log("\n测试不同文件类型的哈希计算:");
  console.log("----------------------------------------");

  for (const [fileType, filePath] of Object.entries(testFiles)) {
    console.log(`\n测试文件类型: ${fileType}`);
    console.log(`文件路径: ${filePath}`);
    console.log(`文件大小: ${fs.statSync(filePath).size} 字节`);

    try {
      const cryptoHash = await calculateHashWithCrypto(filePath);
      console.log(`Node.js crypto哈希 (流式): ${cryptoHash}`);

      const nativeCryptoHash = await calculateHashWithNativeCrypto(filePath);
      console.log(`Node.js crypto哈希 (一次性): ${nativeCryptoHash}`);

      const nativeCryptoChunkedHash =
        await calculateHashWithNativeCryptoChunked(filePath);
      console.log(`Node.js crypto哈希 (分块): ${nativeCryptoChunkedHash}`);

      // 验证哈希值是否一致
      const hashesMatch =
        cryptoHash === nativeCryptoHash &&
        nativeCryptoHash === nativeCryptoChunkedHash;
      console.log(`哈希值一致: ${hashesMatch ? "是" : "否"}`);

      if (!hashesMatch) {
        console.log("警告: 哈希值不一致，可能导致上传问题!");
      }
    } catch (err) {
      console.error(`处理文件 ${fileType} 时出错:`, err);
    }
  }

  console.log("\n----------------------------------------");
  console.log("测试完成!");
}

runTests().catch(console.error);
