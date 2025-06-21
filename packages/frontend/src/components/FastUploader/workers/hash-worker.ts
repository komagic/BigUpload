// 移除 SparkMD5 依赖，使用 Web Crypto API

// Web Worker上下文
const ctx: Worker = self as any;

// 接收消息
ctx.addEventListener("message", (e: MessageEvent) => {
  const { file, chunkSize } = e.data;

  // 计算文件哈希
  calculateFileHash(file, chunkSize)
    .then((hash) => {
      ctx.postMessage({
        hash,
        success: true,
      });
    })
    .catch((error) => {
      ctx.postMessage({
        success: false,
        error: error.message,
      });
    });
});

/**
 * 分片读取文件并计算哈希值
 * @param file 文件对象
 * @param chunkSize 分片大小
 * @returns Promise<string> 文件的SHA-256哈希值
 */
async function calculateFileHash(
  file: File,
  chunkSize: number = 2 * 1024 * 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const chunkHashes: string[] = []; // 存储每个分片的哈希值

    // 上报进度（每10%上报一次）
    const reportInterval = Math.max(1, Math.floor(chunks / 10));

    const loadNext = () => {
      const start = currentChunk * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      fileReader.readAsArrayBuffer(file.slice(start, end));
    };

    fileReader.onload = async (e) => {
      try {
        // 计算当前分片的哈希值
        const buffer = e.target!.result as ArrayBuffer;
        const chunkHashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const chunkHashArray = Array.from(new Uint8Array(chunkHashBuffer));
        const chunkHash = chunkHashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        chunkHashes.push(chunkHash);
        currentChunk++;

        // 上报进度
        if (currentChunk % reportInterval === 0 || currentChunk === chunks) {
          const progress = Math.floor((currentChunk / chunks) * 100);
          ctx.postMessage({
            type: "progress",
            progress,
          });
        }

        if (currentChunk < chunks) {
          // 继续读取下一块
          loadNext();
        } else {
          // 完成，计算最终哈希值
          const combinedHashes = chunkHashes.join("");
          const encoder = new TextEncoder();
          const data = encoder.encode(combinedHashes);
          const finalHashBuffer = await crypto.subtle.digest("SHA-256", data);
          const finalHashArray = Array.from(new Uint8Array(finalHashBuffer));
          const finalHash = finalHashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          resolve(finalHash);
        }
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = (error) => {
      reject(error);
    };

    // 开始读取第一块
    loadNext();
  });
}
