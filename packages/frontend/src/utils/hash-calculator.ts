import { FileHasher } from "@bigupload/shared";
import SparkMD5 from "spark-md5";

export class WebFileHasher implements FileHasher {
  /**
   * 计算文件哈希值
   * @param file 文件对象
   * @returns Promise<string> 哈希值
   */
  async calculateHash(file: File): Promise<string> {
    try {
      console.log(
        `开始计算文件哈希: ${file.name}, 类型: ${file.type}, 大小: ${file.size}字节`
      );

      // 对于小文件（小于20MB），使用整体计算方法
      if (file.size < 20 * 1024 * 1024) {
        return await this.calculateWholeFileHash(file);
      }
      
      // 对于大文件使用分块计算方法
      return await this.calculateChunkedHash(file);
    } catch (err) {
      console.error("Hash calculation error:", err);
      throw {
        type: "HASH_CALCULATION_ERROR",
        message: "文件哈希计算失败",
        retryable: false,
      };
    }
  }

  /**
   * 计算整个文件的哈希（适用于小文件）
   */
  private calculateWholeFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) {
            throw new Error("读取文件结果为空");
          }
          
          const buffer = e.target.result as ArrayBuffer;
          const spark = new SparkMD5.ArrayBuffer();
          spark.append(buffer);
          const hash = spark.end();
          console.log(`小文件哈希计算完成: ${hash}`);
          resolve(hash);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = (e) => {
        reject(new Error("文件读取失败"));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 分块计算文件哈希，适用于所有文件类型
   */
  private calculateChunkedHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // 使用更小的块大小来保证哈希计算的准确性
      const chunkSize = 2 * 1024 * 1024; // 2MB
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();

      console.log(
        `分块计算哈希: 总分块数=${chunks}, 每块大小=${chunkSize}字节`
      );

      // 处理下一个分块
      const loadNext = () => {
        try {
          // 如果已处理完所有分块，计算最终哈希值
          if (currentChunk >= chunks) {
            console.log("所有分块处理完成，计算最终哈希值");
            const hash = spark.end();
            resolve(hash);
            return;
          }

          // 计算当前分块的范围
          const start = currentChunk * chunkSize;
          const end = Math.min(start + chunkSize, file.size);

          // 从文件中提取当前分块
          const chunk = file.slice(start, end);

          // 读取分块内容
          fileReader.readAsArrayBuffer(chunk);
        } catch (err) {
          console.error("加载分块失败:", err);
          reject(err);
        }
      };

      // 分块加载完成的处理函数
      fileReader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) {
            throw new Error("读取分块结果为空");
          }

          const buffer = e.target.result as ArrayBuffer;

          // 将当前分块添加到哈希计算中
          spark.append(buffer);

          // 增加分块计数
          currentChunk++;

          // 每处理10个分块输出一次日志
          if (currentChunk % 10 === 0 || currentChunk === chunks) {
            console.log(
              `已处理 ${currentChunk}/${chunks} 个分块 (${Math.round(
                (currentChunk / chunks) * 100
              )}%)`
            );
          }

          // 使用setTimeout避免调用栈溢出，特别是对于大文件
          setTimeout(loadNext, 0);
        } catch (err) {
          console.error("处理分块数据失败:", err);
          reject(err);
        }
      };

      // 处理读取错误
      fileReader.onerror = (e) => {
        console.error("文件读取错误:", e);
        reject(new Error("文件读取失败"));
      };

      // 开始处理第一个分块
      loadNext();
    });
  }
}
