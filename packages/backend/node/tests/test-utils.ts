import crypto from "crypto";
import fs from "fs-extra";
import path from "path";

export interface TestFile {
  id: string;
  name: string;
  hash: string;
  content: Buffer;
  chunks: Buffer[];
  chunkTotal: number;
}

export class TestFileGenerator {
  /**
   * 生成测试文件数据
   */
  static generateTestFile(
    options: {
      id?: string;
      name?: string;
      content?: string;
      chunkSize?: number;
    } = {}
  ): TestFile {
    const {
      id = `test-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name = "test-file.txt",
      content = "This is a test file content for uploading.",
      chunkSize = 10,
    } = options;

    const contentBuffer = Buffer.from(content);

    // 计算文件哈希
    const hash = crypto.createHash("sha256");
    hash.update(contentBuffer);
    const fileHash = hash.digest("hex");

    // 将内容分割成分片
    const chunks: Buffer[] = [];
    for (let i = 0; i < contentBuffer.length; i += chunkSize) {
      const chunk = contentBuffer.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    return {
      id,
      name,
      hash: fileHash,
      content: contentBuffer,
      chunks,
      chunkTotal: chunks.length,
    };
  }

  /**
   * 生成大文件测试数据
   */
  static generateLargeTestFile(
    sizeInMB: number,
    chunkSizeInMB: number = 1
  ): TestFile {
    const id = `large-file-${Date.now()}`;
    const name = `large-file-${sizeInMB}mb.bin`;
    const sizeInBytes = sizeInMB * 1024 * 1024;
    const chunkSizeInBytes = chunkSizeInMB * 1024 * 1024;

    // 生成随机内容
    const content = crypto.randomBytes(sizeInBytes);

    // 计算哈希
    const hash = crypto.createHash("sha256");
    hash.update(content);
    const fileHash = hash.digest("hex");

    // 分割成分片
    const chunks: Buffer[] = [];
    for (let i = 0; i < content.length; i += chunkSizeInBytes) {
      const chunk = content.slice(i, i + chunkSizeInBytes);
      chunks.push(chunk);
    }

    return {
      id,
      name,
      hash: fileHash,
      content,
      chunks,
      chunkTotal: chunks.length,
    };
  }

  /**
   * 生成具有特定模式的测试文件
   */
  static generatePatternTestFile(
    pattern: string,
    repeatCount: number
  ): TestFile {
    const id = `pattern-file-${Date.now()}`;
    const name = `pattern-file.txt`;
    const content = pattern.repeat(repeatCount);

    return this.generateTestFile({
      id,
      name,
      content,
      chunkSize: Math.max(10, Math.floor(content.length / 5)), // 分成5个分片
    });
  }
}

export class TestDataValidator {
  /**
   * 验证合并后的文件内容是否正确
   */
  static async validateMergedFile(
    filePath: string,
    expectedContent: Buffer
  ): Promise<boolean> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      const actualContent = await fs.readFile(filePath);
      return Buffer.compare(actualContent, expectedContent) === 0;
    } catch (error) {
      console.error("验证合并文件失败:", error);
      return false;
    }
  }

  /**
   * 验证文件哈希是否正确
   */
  static async validateFileHash(
    filePath: string,
    expectedHash: string
  ): Promise<boolean> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      const content = await fs.readFile(filePath);
      const hash = crypto.createHash("sha256");
      hash.update(content);
      const actualHash = hash.digest("hex");

      return actualHash === expectedHash;
    } catch (error) {
      console.error("验证文件哈希失败:", error);
      return false;
    }
  }

  /**
   * 验证分片文件是否存在
   */
  static async validateChunkFiles(
    tempDir: string,
    fileId: string,
    expectedChunkCount: number
  ): Promise<{ existing: number[]; missing: number[] }> {
    const fileDir = path.resolve(tempDir, fileId);
    const existing: number[] = [];
    const missing: number[] = [];

    for (let i = 0; i < expectedChunkCount; i++) {
      const chunkPath = path.resolve(fileDir, i.toString());
      if (await fs.pathExists(chunkPath)) {
        existing.push(i);
      } else {
        missing.push(i);
      }
    }

    return { existing, missing };
  }
}

export class TestFileCleanup {
  /**
   * 清理测试文件
   */
  static async cleanupTestFiles(
    uploadDir: string,
    fileHashes: string[]
  ): Promise<void> {
    for (const hash of fileHashes) {
      try {
        // 尝试清理不同扩展名的文件
        const extensions = [".txt", ".bin", ".dat", ""];
        for (const ext of extensions) {
          const filePath = path.resolve(uploadDir, `${hash}${ext}`);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
          }
        }
      } catch (error) {
        console.warn(`清理测试文件失败 ${hash}:`, error);
      }
    }
  }

  /**
   * 清理临时目录
   */
  static async cleanupTempDir(
    tempDir: string,
    fileIds: string[]
  ): Promise<void> {
    for (const fileId of fileIds) {
      try {
        const fileDir = path.resolve(tempDir, fileId);
        if (await fs.pathExists(fileDir)) {
          await fs.remove(fileDir);
        }
      } catch (error) {
        console.warn(`清理临时目录失败 ${fileId}:`, error);
      }
    }
  }
}

export class PerformanceTracker {
  private startTime: number;
  private markers: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 标记时间点
   */
  mark(label: string): void {
    this.markers.set(label, Date.now());
  }

  /**
   * 获取从开始到指定标记的时间
   */
  getElapsedTime(label?: string): number {
    const endTime = label ? this.markers.get(label) || Date.now() : Date.now();
    return endTime - this.startTime;
  }

  /**
   * 获取两个标记之间的时间
   */
  getTimeBetween(startLabel: string, endLabel: string): number {
    const startTime = this.markers.get(startLabel);
    const endTime = this.markers.get(endLabel);

    if (!startTime || !endTime) {
      throw new Error(`标记不存在: ${startLabel} 或 ${endLabel}`);
    }

    return endTime - startTime;
  }

  /**
   * 获取性能报告
   */
  getReport(): Record<string, number> {
    const report: Record<string, number> = {};
    const sortedMarkers = Array.from(this.markers.entries()).sort(
      (a, b) => a[1] - b[1]
    );

    let lastTime = this.startTime;
    for (const [label, time] of sortedMarkers) {
      report[`${label}_elapsed`] = time - this.startTime;
      report[`${label}_since_last`] = time - lastTime;
      lastTime = time;
    }

    return report;
  }
}

export const TestHelpers = {
  /**
   * 等待指定时间
   */
  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * 重试执行函数
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  },

  /**
   * 生成随机字符串
   */
  generateRandomString(length: number = 10): string {
    return crypto
      .randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length);
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  },
};
