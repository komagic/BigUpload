// HashWorkerManager.ts - 多线程文件Hash计算管理器
import { hashWorkerCode } from "./HashWorkerCode";

export interface HashProgress {
  fileId: string;
  completedChunks: number;
  totalChunks: number;
  progress: number;
  speed?: number; // bytes/second
  elapsedTime?: number; // milliseconds
}

export interface ChunkResult {
  index: number;
  hash: string;
  size: number;
}

export interface HashCalculationResult {
  hash: string;
  elapsedTime: number;
  speed: number; // bytes/second
  workerCount: number;
  chunkCount: number;
}

export class HashWorkerManager {
  private workerCount: number;
  private onProgress?: (progress: HashProgress) => void;
  private fileProgress: Map<
    string,
    {
      completed: number;
      total: number;
      startTime: number;
      fileSize: number;
    }
  > = new Map();

  // 分片大小：2MB，与后端保持一致
  private readonly CHUNK_SIZE = 2 * 1024 * 1024;

  constructor(
    workerCount?: number,
    onProgress?: (progress: HashProgress) => void
  ) {
    // 使用硬件并发数，但限制在合理范围内
    this.workerCount =
      workerCount || Math.min(navigator.hardwareConcurrency || 4, 8);
    this.onProgress = onProgress;
  }

  public async calculateFileHash(
    file: File,
    fileId: string
  ): Promise<HashCalculationResult> {
    const startTime = Date.now();
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // 初始化进度跟踪
    this.fileProgress.set(fileId, {
      completed: 0,
      total: totalChunks,
      startTime,
      fileSize: file.size,
    });

    console.log(
      `🧮 开始多线程Hash计算: ${file.name}, 使用 ${this.workerCount} 个Worker, 共 ${totalChunks} 个分片`
    );

    try {
      // 使用多线程计算分片hash
      const chunksHash = await this.cutFile(file, fileId);

      // 计算整体hash
      const finalHash = await this.calculateOverallHash(chunksHash);

      const elapsedTime = Date.now() - startTime;
      const speed = Math.round((file.size / elapsedTime) * 1000); // bytes/second

      console.log(
        `✅ 多线程Hash计算完成: ${finalHash}, 耗时: ${elapsedTime}ms, 速度: ${speed} bytes/s`
      );

      // 清理进度跟踪
      this.fileProgress.delete(fileId);

      return {
        hash: finalHash,
        elapsedTime,
        speed,
        workerCount: this.workerCount,
        chunkCount: totalChunks,
      };
    } catch (error) {
      console.error("❌ 多线程Hash计算失败:", error);
      this.fileProgress.delete(fileId);
      throw error;
    }
  }

  private async cutFile(file: File, fileId: string): Promise<ChunkResult[]> {
    return new Promise((resolve, reject) => {
      const chunkCount = Math.ceil(file.size / this.CHUNK_SIZE);
      console.log("总的分片数量:", chunkCount);

      // 计算每一个线程处理多少个分片
      const threadCount = Math.ceil(chunkCount / this.workerCount);
      console.log("每个线程处理的分片数量:", threadCount);

      const result: ChunkResult[][] = [];
      let finishCount = 0;

      console.log("总共创建线程数量:", this.workerCount);

      // 创建线程的循环
      for (let i = 0; i < this.workerCount; i++) {
        // 使用Blob创建Worker，避免外部文件依赖
        const blob = new Blob([hashWorkerCode], {
          type: "application/javascript",
        });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        let start = i * threadCount;
        let end = (i + 1) * threadCount;
        if (end > chunkCount) {
          end = chunkCount;
        }

        // 如果start >= chunkCount，说明这个worker没有任务
        if (start >= chunkCount) {
          finishCount++;
          if (finishCount === this.workerCount) {
            resolve(result.flat().sort((a, b) => a.index - b.index));
          }
          URL.revokeObjectURL(workerUrl);
          continue;
        }

        console.log(`线程 ${i + 1} 处理的分片范围: start=${start}, end=${end}`);

        worker.postMessage({
          file,
          start,
          end,
          CHUNK_SIZE: this.CHUNK_SIZE,
        });

        worker.onmessage = (e) => {
          if (e.data.error) {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(new Error(e.data.error));
            return;
          }

          result[i] = e.data;
          console.log(`线程 ${i + 1} 完成，处理了 ${e.data.length} 个分片`);

          // 更新进度
          this.updateProgressFromWorker(fileId, e.data);

          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          finishCount++;

          if (finishCount === this.workerCount) {
            // 按分片索引排序
            const sortedResult = result
              .flat()
              .sort((a, b) => a.index - b.index);
            console.log("所有线程完成，分片hash计算结果:", sortedResult);
            resolve(sortedResult);
          }
        };

        worker.onerror = (error) => {
          console.error(`Worker ${i} 错误:`, error);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          reject(error);
        };
      }
    });
  }

  private updateProgressFromWorker(
    fileId: string,
    workerResult: ChunkResult[]
  ): void {
    const progress = this.fileProgress.get(fileId);
    if (progress && this.onProgress) {
      progress.completed += workerResult.length;
      const progressPercent = Math.round(
        (progress.completed / progress.total) * 100
      );

      const elapsedTime = Date.now() - progress.startTime;
      const completedBytes =
        (progress.completed / progress.total) * progress.fileSize;
      const speed =
        elapsedTime > 0 ? Math.round((completedBytes / elapsedTime) * 1000) : 0;

      this.onProgress({
        fileId,
        completedChunks: progress.completed,
        totalChunks: progress.total,
        progress: progressPercent,
        speed,
        elapsedTime,
      });
    }
  }

  private async calculateOverallHash(
    chunksHash: ChunkResult[]
  ): Promise<string> {
    if (chunksHash.length === 1) {
      // 只有一个分片，直接返回其hash值
      return chunksHash[0].hash;
    } else {
      // 将每个分片的哈希值拼接起来，然后计算最终hash
      const combinedHashes = chunksHash.map((chunk) => chunk.hash).join("");

      try {
        // 使用 Web Crypto API 计算 SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(combinedHashes);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);

        // 转换为十六进制字符串
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (error) {
        // 如果 crypto.subtle 不可用，使用简化的 hash 函数
        let hash = 0;
        for (let i = 0; i < combinedHashes.length; i++) {
          const char = combinedHashes.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
      }
    }
  }

  public destroy(): void {
    // 清理进度跟踪
    this.fileProgress.clear();
  }

  public getWorkerCount(): number {
    return this.workerCount;
  }

  public getActiveTaskCount(): number {
    return this.fileProgress.size;
  }

  public setWorkerCount(count: number): void {
    this.workerCount = Math.min(Math.max(1, count), 16); // 限制在1-16之间
  }
}
