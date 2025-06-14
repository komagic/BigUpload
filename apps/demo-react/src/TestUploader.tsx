import React, { useState, useEffect, useRef } from "react";
import { BigUploader } from "@bigupload/react";
import SparkMD5 from "spark-md5";

// 文件类型定义
const FILE_TYPES = {
  TEXT: ".txt,.md,.doc,.docx,.rtf,.odt",
  PDF: ".pdf",
  IMAGE:
    ".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.svg,.ico,.avif,.heic,.heif",
  VIDEO:
    ".mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v,.3gp,.mpg,.mpeg,.ts,.mts,.m2ts,.vob,.ogv,.rm,.rmvb,.asf,.divx,.xvid,.f4v,.m2v,.mpv,.qt",
  AUDIO:
    ".mp3,.wav,.ogg,.aac,.flac,.wma,.m4a,.ape,.dsd,.opus,.aiff,.au,.ra,.amr,.ac3,.dts,.pcm",
  ARCHIVE:
    ".zip,.rar,.7z,.tar,.gz,.bz2,.xz,.tar.gz,.tar.bz2,.tar.xz,.dmg,.iso,.cab,.deb,.rpm,.msi",
  DOCUMENT:
    ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.rtf,.odt,.ods,.odp,.pages,.numbers,.keynote",
  CODE: ".js,.ts,.jsx,.tsx,.html,.css,.scss,.sass,.less,.json,.xml,.yaml,.yml,.md,.py,.java,.cpp,.c,.h,.cs,.php,.rb,.go,.rust,.swift,.kt,.sql,.sh,.bat,.ps1",
  // 任意文件类型 - 不进行文件类型限制
  ALL: "*",
};

// 测试用例定义
interface TestCase {
  id: string;
  name: string;
  description: string;
  accept: string;
  chunkSize: number;
}

const TEST_CASES: TestCase[] = [
  {
    id: "text",
    name: "文本文件测试",
    accept: FILE_TYPES.TEXT,
    description: "测试上传小型文本文件（TXT、MD、DOC等）",
    chunkSize: 512 * 1024, // 512KB
  },
  {
    id: "pdf",
    name: "PDF文件测试",
    accept: FILE_TYPES.PDF,
    description: "测试上传PDF文件",
    chunkSize: 1 * 1024 * 1024, // 1MB
  },
  {
    id: "image",
    name: "图片文件测试",
    accept: FILE_TYPES.IMAGE,
    description: "测试上传图片文件（JPG、PNG、GIF、WebP等）",
    chunkSize: 1 * 1024 * 1024, // 1MB
  },
  {
    id: "video",
    name: "视频文件测试",
    accept: FILE_TYPES.VIDEO,
    description: "测试上传视频文件（MP4、AVI、MOV、MKV等）",
    chunkSize: 5 * 1024 * 1024, // 5MB
  },
  {
    id: "audio",
    name: "音频文件测试",
    accept: FILE_TYPES.AUDIO,
    description: "测试上传音频文件（MP3、WAV、FLAC等）",
    chunkSize: 2 * 1024 * 1024, // 2MB
  },
  {
    id: "archive",
    name: "压缩文件测试",
    accept: FILE_TYPES.ARCHIVE,
    description: "测试上传压缩文件（ZIP、RAR、7Z等）",
    chunkSize: 3 * 1024 * 1024, // 3MB
  },
  {
    id: "document",
    name: "文档文件测试",
    accept: FILE_TYPES.DOCUMENT,
    description: "测试上传文档文件（Office、PDF等）",
    chunkSize: 2 * 1024 * 1024, // 2MB
  },
  {
    id: "code",
    name: "代码文件测试",
    accept: FILE_TYPES.CODE,
    description: "测试上传代码文件（JS、TS、Python等）",
    chunkSize: 1 * 1024 * 1024, // 1MB
  },
  {
    id: "large",
    name: "大文件测试",
    accept: FILE_TYPES.ALL,
    description: "测试上传大文件（>100MB，所有格式）",
    chunkSize: 10 * 1024 * 1024, // 10MB
  },
];

// 文件哈希计算工具
const calculateFileHash = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(buffer);
        const hash = spark.end();
        resolve(hash);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

// 测试结果接口
interface TestResult {
  caseId: string;
  success: boolean;
  fileName: string;
  fileSize: number;
  fileHash: string;
  uploadDuration: number;
  hashDuration: number;
  message: string;
  serverHash?: string;
  url?: string;
}

// 测试上传器组件
const TestUploader: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [url, setUrl] = useState("http://localhost:3000");
  const [results, setResults] = useState<TestResult[]>([]);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [currentTest, setCurrentTest] = useState<{
    startTime: number;
    case: TestCase | null;
  }>({
    startTime: 0,
    case: null,
  });

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(2) + "s";
  };

  // 选择测试用例
  const selectTestCase = (testCase: TestCase) => {
    setSelectedCase(testCase);
    setCurrentError(null);

    // 重置当前测试状态
    setCurrentTest({
      startTime: Date.now(),
      case: testCase,
    });
  };

  // 注意：这个函数暂时不使用，因为BigUploader会自动处理文件
  const handleFilesAdded = async (files: File[]) => {
    // 这个函数目前没有使用，因为BigUploader会直接处理文件选择
    console.log("Files added to BigUploader:", files);
  };

  // 处理上传成功
  const handleSuccess = (fileId: string, result: any) => {
    if (!currentTest.case) return;

    const endTime = Date.now();
    const uploadDuration = endTime - currentTest.startTime;

    setResults((prev) => [
      ...prev,
      {
        caseId: currentTest.case!.id,
        success: true,
        fileName: result.fileName || fileId,
        fileSize: result.fileSize || 0,
        fileHash: result.fileHash || fileId,
        uploadDuration,
        hashDuration: result.hashTime || 0,
        message: result.message || "上传成功",
        serverHash: fileId,
        url: result.url,
      },
    ]);
  };

  // 处理上传错误
  const handleError = (fileId: string, error: any) => {
    if (!currentTest.case) return;

    const errorMsg = `上传失败: ${error.message || error.toString()}`;
    setCurrentError(errorMsg);

    setResults((prev) => [
      ...prev,
      {
        caseId: currentTest.case!.id,
        success: false,
        fileName: error.fileName || fileId,
        fileSize: error.fileSize || 0,
        fileHash: error.fileHash || fileId,
        uploadDuration: Date.now() - currentTest.startTime,
        hashDuration: error.hashTime || 0,
        message: errorMsg,
      },
    ]);
  };

  // 处理上传进度
  const handleProgress = (fileId: string, progress: any) => {
    // 可以在这里添加进度处理逻辑
    console.log(`文件 ${fileId} 上传进度:`, progress);
  };

  // 清除测试结果
  const clearResults = () => {
    setResults([]);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <section className="test-controls">
        <h2>测试用例</h2>
        <div className="test-cases">
          {TEST_CASES.map((testCase) => (
            <button
              key={testCase.id}
              className={`test-case ${
                selectedCase?.id === testCase.id ? "active" : ""
              }`}
              onClick={() => selectTestCase(testCase)}
            >
              {testCase.name}
            </button>
          ))}
        </div>

        <div className="server-config">
          <label htmlFor="server-url">服务器地址:</label>
          <input
            id="server-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="例如: http://localhost:3000"
          />
        </div>
      </section>

      <section className="test-results">
        <div className="results-header">
          <h2>测试结果</h2>
          {results.length > 0 && (
            <button className="clear-results" onClick={clearResults}>
              清除结果
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="no-results">
            尚无测试结果。请选择一个测试用例并上传文件。
          </p>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>测试用例</th>
                <th>文件</th>
                <th>大小</th>
                <th>哈希计算时间</th>
                <th>上传时间</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => {
                // 根据测试ID获取测试用例名称
                const testCase = TEST_CASES.find(
                  (tc) => tc.id === result.caseId
                );
                return (
                  <tr
                    key={index}
                    className={result.success ? "success" : "error"}
                  >
                    <td>{testCase?.name || result.caseId}</td>
                    <td title={result.fileName}>
                      {result.fileName.length > 20
                        ? result.fileName.substring(0, 17) + "..."
                        : result.fileName}
                    </td>
                    <td>{formatFileSize(result.fileSize)}</td>
                    <td>{formatTime(result.hashDuration)}</td>
                    <td>
                      {result.uploadDuration
                        ? formatTime(result.uploadDuration)
                        : "-"}
                    </td>
                    <td title={result.message}>
                      {result.success ? "✅ 成功" : "❌ 失败"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 当前错误显示 */}
      {currentError && (
        <div
          className="error-display"
          style={{
            backgroundColor: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: "4px",
            padding: "12px",
            margin: "16px 0",
            color: "#c62828",
          }}
        >
          <strong>错误:</strong> {currentError}
        </div>
      )}

      {/* 上传组件 */}
      {selectedCase && (
        <div className="uploader-container">
          <h3>正在测试: {selectedCase.name}</h3>
          <p>{selectedCase.description}</p>
          <p>分片大小: {formatFileSize(selectedCase.chunkSize)}</p>
          <p>支持的文件类型: {selectedCase.accept}</p>

          <BigUploader
            baseUrl={url}
            chunkSize={selectedCase.chunkSize}
            concurrent={3}
            accept={
              selectedCase.accept === "*" ? [] : selectedCase.accept.split(",")
            }
            autoStart={true}
            onSuccess={handleSuccess}
            onError={handleError}
            onProgress={handleProgress}
          />
        </div>
      )}
    </div>
  );
};

export default TestUploader;
