// HashWorkerCode.ts - Web Worker 代码字符串，用于多线程计算文件分片Hash
export const hashWorkerCode = `
// 将 ArrayBuffer 转换为十六进制字符串
function arrayBufferToHex(buffer) {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Worker 消息处理函数
self.onmessage = async function(e) {
  const { file, start, end, CHUNK_SIZE } = e.data;
  
  try {
    console.log(\`🔧 Worker[\${self.name || 'unnamed'}] 开始处理分片: [\${start}, \${end}), 共\${end - start}个分片\`);
    
    const chunkResults = [];
    
    // 处理分片范围内的每个分片
    for (let i = start; i < end; i++) {
      const chunkStart = i * CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
      const chunk = file.slice(chunkStart, chunkEnd);
      
      // 使用 arrayBuffer() 方法读取分片内容
      const arrayBuffer = await chunk.arrayBuffer();
      
      // 使用 Web Crypto API 计算 SHA-256
      let chunkHash;
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        chunkHash = arrayBufferToHex(hashBuffer);
      } catch (cryptoError) {
        // 如果 crypto.subtle 不可用，回退到简单哈希
        console.warn(\`⚠️ crypto.subtle 不可用，使用回退方案\`);
        // 简单的回退哈希实现
        let hash = 0;
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let j = 0; j < uint8Array.length; j++) {
          hash = ((hash << 5) - hash + uint8Array[j]) & 0xffffffff;
        }
        chunkHash = Math.abs(hash).toString(16).padStart(8, '0');
      }
      
      chunkResults.push({
        index: i,
        hash: chunkHash,
        size: chunkEnd - chunkStart
      });
    }
    
    console.log(\`✅ Worker[\${self.name || 'unnamed'}] 完成处理，共处理 \${chunkResults.length} 个分片\`);
    
    // 返回结果
    self.postMessage(chunkResults);
    
  } catch (error) {
    console.error('❌ Worker 处理错误:', error);
    self.postMessage({ error: error.message });
  }
};
`;
