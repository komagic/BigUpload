// SimpleHashCalculator.ts - 单线程文件Hash计算器（用于性能对比）

export interface SimpleHashResult {
  hash: string;
  elapsedTime: number;
  speed: number; // bytes/second
  method: "single-thread" | "file-api";
}

export class SimpleHashCalculator {
  /**
   * 使用单线程分片计算文件哈希
   */
  public static async calculateFileHashChunked(
    file: File
  ): Promise<SimpleHashResult> {
    const startTime = Date.now();
    const chunkSize = 2 * 1024 * 1024; // 2MB
    const chunks = Math.ceil(file.size / chunkSize);
    const chunkHashes: string[] = [];

    console.log(`🔍 开始单线程分片Hash计算: ${file.name}, 共 ${chunks} 个分片`);

    try {
      // 逐个处理分片
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const arrayBuffer = await chunk.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const chunkHash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        chunkHashes.push(chunkHash);

        // 每处理10个分片输出一次进度
        if ((i + 1) % 10 === 0 || i === chunks - 1) {
          console.log(
            `🔍 单线程处理进度: ${i + 1}/${chunks} (${Math.round(
              ((i + 1) / chunks) * 100
            )}%)`
          );
        }
      }

      // 计算最终哈希
      const combinedHashes = chunkHashes.join("");
      const encoder = new TextEncoder();
      const data = encoder.encode(combinedHashes);
      const finalHashBuffer = await crypto.subtle.digest("SHA-256", data);
      const finalHashArray = Array.from(new Uint8Array(finalHashBuffer));
      const finalHash = finalHashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const elapsedTime = Date.now() - startTime;
      const speed = Math.round((file.size / elapsedTime) * 1000);

      console.log(
        `✅ 单线程分片Hash计算完成: ${finalHash}, 耗时: ${elapsedTime}ms, 速度: ${speed} bytes/s`
      );

      return {
        hash: finalHash,
        elapsedTime,
        speed,
        method: "single-thread",
      };
    } catch (error) {
      console.error("❌ 单线程Hash计算失败:", error);
      throw error;
    }
  }

  /**
   * 使用FileReader API一次性读取整个文件计算哈希
   */
  public static async calculateFileHashWhole(
    file: File
  ): Promise<SimpleHashResult> {
    const startTime = Date.now();

    console.log(
      `📄 开始整体文件Hash计算: ${file.name}, 大小: ${file.size} bytes`
    );

    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const elapsedTime = Date.now() - startTime;
      const speed = Math.round((file.size / elapsedTime) * 1000);

      console.log(
        `✅ 整体文件Hash计算完成: ${hash}, 耗时: ${elapsedTime}ms, 速度: ${speed} bytes/s`
      );

      return {
        hash,
        elapsedTime,
        speed,
        method: "file-api",
      };
    } catch (error) {
      console.error("❌ 整体文件Hash计算失败:", error);
      throw error;
    }
  }
}
