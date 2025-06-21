/**
 * useBigUpload Hook 单元测试
 * 基于 React Testing Library 和 Jest
 */

/// <reference path="../../types/jest.d.ts" />

import { renderHook, act } from "@testing-library/react";
import { useBigUpload, UseBigUploadOptions } from "../useBigUpload";
import {
  BigUploadEngine,
  FileUploadState,
  UploadProgress,
} from "../../core/BigUploadEngine";

// Mock BigUploadEngine
jest.mock("../../core/BigUploadEngine");

const MockedBigUploadEngine = jest.mocked(BigUploadEngine);

describe("useBigUpload Hook", () => {
  let mockEngine: jest.Mocked<BigUploadEngine>;
  let mockFile: File;
  let mockFileList: FileList;

  const defaultOptions: UseBigUploadOptions = {
    baseUrl: "http://localhost:3000/api",
    chunkSize: 1024 * 1024, // 1MB
    concurrent: 3,
    autoStart: false,
  };

  beforeEach(() => {
    // 创建 Mock 引擎实例
    mockEngine = {
      addFile: jest.fn(),
      startUpload: jest.fn(),
      pauseUpload: jest.fn(),
      resumeUpload: jest.fn(),
      cancelUpload: jest.fn(),
      removeFile: jest.fn(),
      getAllFiles: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as any;

    // Mock 构造函数
    MockedBigUploadEngine.mockImplementation(() => mockEngine);
    mockEngine.addFile.mockResolvedValue("mock-file-id");

    // Mock 文件对象
    mockFile = new File(["test content"], "test.txt", { type: "text/plain" });

    // Mock FileList
    mockFileList = {
      0: mockFile,
      length: 1,
      item: (index: number) => (index === 0 ? mockFile : null),
      [Symbol.iterator]: function* () {
        yield mockFile;
      },
    } as FileList;

    // Mock 默认返回值
    mockEngine.getAllFiles.mockReturnValue([]);
    mockEngine.on.mockReturnValue(jest.fn()); // 返回 unsubscribe 函数
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Hook 初始化", () => {
    it("应该正确初始化 BigUploadEngine", () => {
      renderHook(() => useBigUpload(defaultOptions));

      expect(MockedBigUploadEngine).toHaveBeenCalledWith({
        baseUrl: defaultOptions.baseUrl,
        chunkSize: defaultOptions.chunkSize,
        concurrent: defaultOptions.concurrent,
        retryDelays: undefined,
        headers: undefined,
        debug: undefined,
      });
    });

    it("应该注册事件监听器", () => {
      renderHook(() => useBigUpload(defaultOptions));

      expect(mockEngine.on).toHaveBeenCalledWith(
        "stateChange",
        expect.any(Function)
      );
      expect(mockEngine.on).toHaveBeenCalledWith(
        "progress",
        expect.any(Function)
      );
      expect(mockEngine.on).toHaveBeenCalledWith(
        "success",
        expect.any(Function)
      );
      expect(mockEngine.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("应该返回初始状态", () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));

      expect(result.current.files).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.engine).toBeDefined();
      expect(result.current.totalProgress).toEqual({
        loaded: 0,
        total: 0,
        percent: 0,
        speed: 0,
        remainingTime: 0,
        uploadedChunks: 0,
        totalChunks: 0,
      });
    });
  });

  describe("文件添加功能", () => {
    it("应该能添加文件", async () => {
      const mockFileId = "mock-file-id";
      mockEngine.addFile.mockResolvedValue(mockFileId);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      let fileIds;
      await act(async () => {
        fileIds = await result.current.addFiles(mockFileList);
      });

      expect(mockEngine.addFile).toHaveBeenCalledWith(mockFile);
      expect(fileIds).toEqual([mockFileId]);
    });

    it("应该验证文件类型", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        accept: [".txt", "image/*"],
      };

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual(["mock-file-id"]);
      });

      expect(mockEngine.addFile).toHaveBeenCalled();
    });

    it("应该拒绝不支持的文件类型", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        accept: [".pdf"],
      };

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual([]); // 应该返回空数组，因为文件被拒绝
      });

      expect(mockEngine.addFile).not.toHaveBeenCalled();
    });

    it("应该验证文件大小", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        maxFileSize: 10, // 10 bytes
      };

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual([]); // 文件太大，应该被拒绝
      });

      expect(mockEngine.addFile).not.toHaveBeenCalled();
    });

    it("应该限制文件数量", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        maxFiles: 1,
      };

      mockEngine.getAllFiles.mockReturnValue([
        { fileId: "existing-file" } as FileUploadState,
      ]);

      const { result } = renderHook(() => useBigUpload(options));

      await expect(
        act(async () => {
          await result.current.addFiles(mockFileList);
        })
      ).rejects.toThrow("最多只能上传 1 个文件");
    });

    it("应该在autoStart为true时自动开始上传", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        autoStart: true,
      };

      const mockFileId = "mock-file-id";
      mockEngine.addFile.mockResolvedValue(mockFileId);

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        await result.current.addFiles(mockFileList);
      });

      expect(mockEngine.startUpload).toHaveBeenCalledWith(mockFileId);
    });
  });

  describe("上传控制功能", () => {
    it("应该能开始上传指定文件", async () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));
      const fileId = "test-file-id";

      await act(async () => {
        await result.current.startUpload(fileId);
      });

      expect(mockEngine.startUpload).toHaveBeenCalledWith(fileId);
    });

    it("应该能开始上传所有待上传文件", async () => {
      const pendingFiles: FileUploadState[] = [
        { fileId: "file1", status: "pending" } as FileUploadState,
        { fileId: "file2", status: "pending" } as FileUploadState,
        { fileId: "file3", status: "completed" } as FileUploadState,
      ];

      mockEngine.getAllFiles.mockReturnValue(pendingFiles);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        await result.current.startUpload();
      });

      expect(mockEngine.startUpload).toHaveBeenCalledWith("file1");
      expect(mockEngine.startUpload).toHaveBeenCalledWith("file2");
      expect(mockEngine.startUpload).not.toHaveBeenCalledWith("file3");
    });

    it("应该能暂停上传", () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));
      const fileId = "test-file-id";

      act(() => {
        result.current.pauseUpload(fileId);
      });

      expect(mockEngine.pauseUpload).toHaveBeenCalledWith(fileId);
    });

    it("应该能继续上传", async () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));
      const fileId = "test-file-id";

      await act(async () => {
        await result.current.resumeUpload(fileId);
      });

      expect(mockEngine.resumeUpload).toHaveBeenCalledWith(fileId);
    });

    it("应该能取消上传", () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));
      const fileId = "test-file-id";

      act(() => {
        result.current.cancelUpload(fileId);
      });

      expect(mockEngine.cancelUpload).toHaveBeenCalledWith(fileId);
    });
  });

  describe("文件管理功能", () => {
    it("应该能移除文件", () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));
      const fileId = "test-file-id";

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(mockEngine.removeFile).toHaveBeenCalledWith(fileId);
    });

    it("应该能清空所有文件", () => {
      const allFiles: FileUploadState[] = [
        { fileId: "file1" } as FileUploadState,
        { fileId: "file2" } as FileUploadState,
      ];

      mockEngine.getAllFiles.mockReturnValue(allFiles);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      act(() => {
        result.current.clearFiles();
      });

      expect(mockEngine.removeFile).toHaveBeenCalledWith("file1");
      expect(mockEngine.removeFile).toHaveBeenCalledWith("file2");
    });
  });

  describe("状态更新", () => {
    it("应该响应stateChange事件", () => {
      let stateChangeHandler: Function;
      mockEngine.on.mockImplementation((event, handler) => {
        if (event === "stateChange") {
          stateChangeHandler = handler;
        }
        return jest.fn();
      });

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      const newState: FileUploadState = {
        fileId: "test-file",
        file: mockFile,
        status: "uploading",
        progress: {
          loaded: 50,
          total: 100,
          percent: 50,
          speed: 1024,
          remainingTime: 5,
          uploadedChunks: 1,
          totalChunks: 2,
        },
      };

      act(() => {
        stateChangeHandler!({ fileId: "test-file", state: newState });
      });

      expect(result.current.files).toEqual([newState]);
    });

    it("应该更新上传状态", () => {
      let progressHandler: Function;
      mockEngine.on.mockImplementation((event, handler) => {
        if (event === "progress") {
          progressHandler = handler;
        }
        return jest.fn();
      });

      const uploadingFiles: FileUploadState[] = [
        { status: "uploading" } as FileUploadState,
      ];

      mockEngine.getAllFiles.mockReturnValue(uploadingFiles);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      act(() => {
        progressHandler!();
      });

      expect(result.current.isUploading).toBe(true);
    });
  });

  describe("进度计算", () => {
    it("应该正确计算总体进度", () => {
      let stateChangeHandler: Function;
      mockEngine.on.mockImplementation((event, handler) => {
        if (event === "stateChange") {
          stateChangeHandler = handler;
        }
        return jest.fn();
      });

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      const files: FileUploadState[] = [
        {
          fileId: "file1",
          file: mockFile,
          status: "uploading",
          progress: {
            loaded: 50,
            total: 100,
            percent: 50,
            speed: 1024,
            remainingTime: 5,
            uploadedChunks: 1,
            totalChunks: 2,
          },
        },
        {
          fileId: "file2",
          file: mockFile,
          status: "uploading",
          progress: {
            loaded: 25,
            total: 100,
            percent: 25,
            speed: 512,
            remainingTime: 10,
            uploadedChunks: 1,
            totalChunks: 4,
          },
        },
      ];

      act(() => {
        files.forEach((file) => {
          stateChangeHandler!({ fileId: file.fileId, state: file });
        });
      });

      expect(result.current.totalProgress).toEqual({
        loaded: 75,
        total: 200,
        percent: 38, // Math.round(75/200 * 100)
        speed: 1536, // 1024 + 512
        remainingTime: 0, // Math.round((200-75)/1536) = 0 (JS 舍入)
        uploadedChunks: 2, // 1 + 1
        totalChunks: 6, // 2 + 4
      });
    });

    it("应该处理空文件列表的进度计算", () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));

      expect(result.current.totalProgress).toEqual({
        loaded: 0,
        total: 0,
        percent: 0,
        speed: 0,
        remainingTime: 0,
        uploadedChunks: 0,
        totalChunks: 0,
      });
    });
  });

  describe("错误处理", () => {
    it("应该处理文件添加失败", async () => {
      mockEngine.addFile.mockRejectedValue(new Error("添加失败"));

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual([]); // 应该返回空数组
      });
    });
  });

  describe("事件监听器清理", () => {
    it("应该在组件卸载时清理事件监听器", () => {
      const unsubscribeFn = jest.fn();
      mockEngine.on.mockReturnValue(unsubscribeFn);

      const { unmount } = renderHook(() => useBigUpload(defaultOptions));

      unmount();

      // 应该调用4次unsubscribe（对应4个事件监听器）
      expect(unsubscribeFn).toHaveBeenCalledTimes(4);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义配置", () => {
      const customOptions: UseBigUploadOptions = {
        baseUrl: "https://api.example.com",
        chunkSize: 2 * 1024 * 1024, // 2MB
        concurrent: 5,
        retryDelays: [1000, 2000, 3000],
        headers: { Authorization: "Bearer token" },
        debug: true,
      };

      renderHook(() => useBigUpload(customOptions));

      expect(MockedBigUploadEngine).toHaveBeenCalledWith({
        baseUrl: customOptions.baseUrl,
        chunkSize: customOptions.chunkSize,
        concurrent: customOptions.concurrent,
        retryDelays: customOptions.retryDelays,
        headers: customOptions.headers,
        debug: customOptions.debug,
      });
    });
  });

  describe("文件类型验证", () => {
    it("应该支持扩展名验证", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        accept: [".txt", ".pdf"],
      };

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual(["mock-file-id"]);
      });
    });

    it("应该支持MIME类型验证", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        accept: ["text/*"],
      };

      // 在测试中显式设置mock文件的MIME类型
      const testFile = new File(["test content"], "test.txt", {
        type: "text/plain",
      });

      const testFileList = {
        0: testFile,
        length: 1,
        item: (index: number) => (index === 0 ? testFile : null),
        [Symbol.iterator]: function* () {
          yield testFile;
        },
      } as FileList;

      // 确保 addFile 对这个文件也返回正确的值
      mockEngine.addFile.mockResolvedValueOnce("mock-file-id");

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(testFileList);
        expect(fileIds).toEqual(["mock-file-id"]);
      });
    });

    it("应该支持通配符验证", async () => {
      const options: UseBigUploadOptions = {
        ...defaultOptions,
        accept: ["*"],
      };

      const { result } = renderHook(() => useBigUpload(options));

      await act(async () => {
        const fileIds = await result.current.addFiles(mockFileList);
        expect(fileIds).toEqual(["mock-file-id"]);
      });
    });
  });
});
