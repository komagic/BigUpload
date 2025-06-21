/**
 * useBigUpload Hook 集成测试
 * 测试复杂场景和边界情况
 */

import { renderHook, act } from "@testing-library/react";
import { useBigUpload, UseBigUploadOptions } from "../useBigUpload";
import { BigUploadEngine, FileUploadState } from "../../core/BigUploadEngine";
import {
  createMockFile,
  createMockFileList,
  createMockFileState,
  createMockFiles,
  MockEventEmitter,
} from "./test-utils";

// Mock BigUploadEngine
jest.mock("../../core/BigUploadEngine");

const MockedBigUploadEngine = jest.mocked(BigUploadEngine);

describe("useBigUpload Hook - 集成测试", () => {
  let mockEngine: jest.Mocked<BigUploadEngine>;
  let eventEmitter: MockEventEmitter;

  const defaultOptions: UseBigUploadOptions = {
    baseUrl: "http://localhost:3000/api",
    chunkSize: 1024 * 1024,
    concurrent: 3,
    autoStart: false,
  };

  beforeEach(() => {
    eventEmitter = new MockEventEmitter();

    mockEngine = {
      addFile: jest.fn(),
      startUpload: jest.fn(),
      pauseUpload: jest.fn(),
      resumeUpload: jest.fn(),
      cancelUpload: jest.fn(),
      removeFile: jest.fn(),
      getAllFiles: jest.fn(),
      getFileState: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as any;

    MockedBigUploadEngine.mockImplementation(() => mockEngine);

    // Mock事件系统
    mockEngine.on.mockImplementation((event, handler) => {
      return eventEmitter.on(event, handler);
    });

    mockEngine.getAllFiles.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventEmitter.clear();
  });

  describe("完整上传流程", () => {
    it("应该完成从添加文件到上传完成的完整流程", async () => {
      const file = createMockFile("test content", "test.txt");
      const fileList = createMockFileList([file]);
      const fileId = "test-file-id";

      mockEngine.addFile.mockResolvedValue(fileId);

      const { result } = renderHook(() =>
        useBigUpload({
          ...defaultOptions,
          autoStart: true,
        })
      );

      // 1. 添加文件
      await act(async () => {
        await result.current.addFiles(fileList);
      });

      expect(mockEngine.addFile).toHaveBeenCalledWith(file);
      expect(mockEngine.startUpload).toHaveBeenCalledWith(fileId);

      // 2. 模拟上传进度更新
      const uploadingState = createMockFileState({
        fileId,
        file,
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
      });

      // 更新 getAllFiles 以返回上传中的状态
      mockEngine.getAllFiles.mockReturnValue([uploadingState]);

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: uploadingState });
        eventEmitter.emit("progress", {});
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].status).toBe("uploading");
      expect(result.current.isUploading).toBe(true);

      // 3. 模拟上传完成
      const completedState = createMockFileState({
        fileId,
        file,
        status: "completed",
        progress: {
          loaded: 100,
          total: 100,
          percent: 100,
          speed: 0,
          remainingTime: 0,
          uploadedChunks: 2,
          totalChunks: 2,
        },
        result: {
          success: true,
          fileId,
          url: "http://example.com/file.txt",
          message: "上传成功",
        },
      });

      // 更新 getAllFiles 以返回完成状态
      mockEngine.getAllFiles.mockReturnValue([completedState]);

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: completedState });
        eventEmitter.emit("success", { fileId, result: completedState.result });
      });

      expect(result.current.files[0].status).toBe("completed");
      expect(result.current.isUploading).toBe(false);
      expect(result.current.totalProgress.percent).toBe(100);
    });

    it("应该处理多文件并发上传", async () => {
      const files = createMockFiles(3);
      const fileList = createMockFileList(files);
      const fileIds = ["file1", "file2", "file3"];

      mockEngine.addFile
        .mockResolvedValueOnce(fileIds[0])
        .mockResolvedValueOnce(fileIds[1])
        .mockResolvedValueOnce(fileIds[2]);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      // 添加多个文件
      await act(async () => {
        await result.current.addFiles(fileList);
      });

      expect(mockEngine.addFile).toHaveBeenCalledTimes(3);

      // 开始上传所有文件
      await act(async () => {
        await result.current.startUpload();
      });

      // 模拟文件状态更新
      const states = fileIds.map((fileId, index) =>
        createMockFileState({
          fileId,
          file: files[index],
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
        })
      );

      act(() => {
        states.forEach((state) => {
          eventEmitter.emit("stateChange", { fileId: state.fileId, state });
        });
      });

      // 验证总体进度
      expect(result.current.totalProgress).toEqual({
        loaded: 75, // 25 * 3
        total: 300, // 100 * 3
        percent: 25, // Math.round(75/300 * 100)
        speed: 1536, // 512 * 3
        remainingTime: 0, // Math.round((300-75)/1536) = 0 (JS 舍入)
        uploadedChunks: 3, // 1 * 3
        totalChunks: 12, // 4 * 3
      });
    });
  });

  describe("错误处理和恢复", () => {
    it("应该处理上传错误并支持重试", async () => {
      const file = createMockFile();
      const fileList = createMockFileList([file]);
      const fileId = "error-file-id";

      mockEngine.addFile.mockResolvedValue(fileId);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        await result.current.addFiles(fileList);
      });

      // 模拟上传错误
      const errorState = createMockFileState({
        fileId,
        file,
        status: "error",
        error: {
          code: "NETWORK_ERROR",
          message: "网络错误",
          retryable: true,
        },
      });

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: errorState });
        eventEmitter.emit("error", { fileId, error: errorState.error });
      });

      expect(result.current.files[0].status).toBe("error");
      expect(result.current.files[0].error?.retryable).toBe(true);

      // 重试上传
      await act(async () => {
        await result.current.resumeUpload(fileId);
      });

      expect(mockEngine.resumeUpload).toHaveBeenCalledWith(fileId);
    });

    it("应该处理不可重试的错误", async () => {
      const file = createMockFile();
      const fileList = createMockFileList([file]);
      const fileId = "fatal-error-file-id";

      mockEngine.addFile.mockResolvedValue(fileId);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        await result.current.addFiles(fileList);
      });

      // 模拟不可重试的错误
      const fatalErrorState = createMockFileState({
        fileId,
        file,
        status: "error",
        error: {
          code: "FILE_TOO_LARGE",
          message: "文件过大",
          retryable: false,
        },
      });

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: fatalErrorState });
        eventEmitter.emit("error", { fileId, error: fatalErrorState.error });
      });

      expect(result.current.files[0].status).toBe("error");
      expect(result.current.files[0].error?.retryable).toBe(false);
    });
  });

  describe("暂停和恢复功能", () => {
    it("应该支持暂停和恢复上传", async () => {
      const file = createMockFile();
      const fileList = createMockFileList([file]);
      const fileId = "pausable-file-id";

      mockEngine.addFile.mockResolvedValue(fileId);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        await result.current.addFiles(fileList);
        await result.current.startUpload(fileId);
      });

      // 模拟上传中状态
      const uploadingState = createMockFileState({
        fileId,
        file,
        status: "uploading",
        progress: {
          loaded: 30,
          total: 100,
          percent: 30,
          speed: 1024,
          remainingTime: 5,
          uploadedChunks: 1,
          totalChunks: 3,
        },
      });

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: uploadingState });
      });

      expect(result.current.files[0].status).toBe("uploading");

      // 暂停上传
      act(() => {
        result.current.pauseUpload(fileId);
      });

      expect(mockEngine.pauseUpload).toHaveBeenCalledWith(fileId);

      // 模拟暂停状态
      const pausedState = createMockFileState({
        fileId,
        file,
        status: "paused",
        progress: {
          loaded: 30,
          total: 100,
          percent: 30,
          speed: 0,
          remainingTime: 0,
          uploadedChunks: 1,
          totalChunks: 3,
        },
      });

      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: pausedState });
      });

      expect(result.current.files[0].status).toBe("paused");

      // 恢复上传
      await act(async () => {
        await result.current.resumeUpload(fileId);
      });

      expect(mockEngine.resumeUpload).toHaveBeenCalledWith(fileId);
    });
  });

  describe("文件管理功能", () => {
    it("应该支持动态添加和移除文件", async () => {
      const { result } = renderHook(() => useBigUpload(defaultOptions));

      // 添加第一批文件
      const files1 = createMockFiles(2);
      const fileList1 = createMockFileList(files1);

      mockEngine.addFile
        .mockResolvedValueOnce("file1")
        .mockResolvedValueOnce("file2");

      await act(async () => {
        await result.current.addFiles(fileList1);
      });

      // 模拟文件状态
      const state1 = createMockFileState({ fileId: "file1", file: files1[0] });
      const state2 = createMockFileState({ fileId: "file2", file: files1[1] });

      act(() => {
        eventEmitter.emit("stateChange", { fileId: "file1", state: state1 });
        eventEmitter.emit("stateChange", { fileId: "file2", state: state2 });
      });

      expect(result.current.files).toHaveLength(2);

      // 移除一个文件
      act(() => {
        result.current.removeFile("file1");
      });

      expect(mockEngine.removeFile).toHaveBeenCalledWith("file1");
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].fileId).toBe("file2");

      // 添加更多文件
      const files2 = createMockFiles(1);
      const fileList2 = createMockFileList(files2);

      mockEngine.addFile.mockResolvedValueOnce("file3");

      await act(async () => {
        await result.current.addFiles(fileList2);
      });

      const state3 = createMockFileState({ fileId: "file3", file: files2[0] });

      act(() => {
        eventEmitter.emit("stateChange", { fileId: "file3", state: state3 });
      });

      expect(result.current.files).toHaveLength(2);

      // 清空所有文件
      mockEngine.getAllFiles.mockReturnValue([
        { fileId: "file2" } as FileUploadState,
        { fileId: "file3" } as FileUploadState,
      ]);

      act(() => {
        result.current.clearFiles();
      });

      expect(mockEngine.removeFile).toHaveBeenCalledWith("file2");
      expect(mockEngine.removeFile).toHaveBeenCalledWith("file3");
      expect(result.current.files).toHaveLength(0);
    });
  });

  describe("性能优化", () => {
    it("应该在大量文件状态更新时保持性能", async () => {
      const fileCount = 100;
      const files = createMockFiles(fileCount);
      const fileList = createMockFileList(files);

      // Mock 大量文件添加
      for (let i = 0; i < fileCount; i++) {
        mockEngine.addFile.mockResolvedValueOnce(`file${i}`);
      }

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      const startTime = performance.now();

      await act(async () => {
        await result.current.addFiles(fileList);
      });

      // 模拟大量状态更新
      act(() => {
        for (let i = 0; i < fileCount; i++) {
          const state = createMockFileState({
            fileId: `file${i}`,
            file: files[i],
            status: "uploading",
            progress: {
              loaded: Math.random() * 100,
              total: 100,
              percent: Math.random() * 100,
              speed: Math.random() * 1024,
              remainingTime: Math.random() * 60,
              uploadedChunks: Math.floor(Math.random() * 10),
              totalChunks: 10,
            },
          });
          eventEmitter.emit("stateChange", { fileId: `file${i}`, state });
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.files).toHaveLength(fileCount);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe("边界情况", () => {
    it("应该处理空文件列表", async () => {
      const emptyFileList = createMockFileList([]);
      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        const fileIds = await result.current.addFiles(emptyFileList);
        expect(fileIds).toEqual([]);
      });

      expect(mockEngine.addFile).not.toHaveBeenCalled();
      expect(result.current.files).toHaveLength(0);
    });

    it("应该处理重复的文件ID", async () => {
      const file = createMockFile();
      const fileList = createMockFileList([file]);
      const fileId = "duplicate-file-id";

      mockEngine.addFile.mockResolvedValue(fileId);

      const { result } = renderHook(() => useBigUpload(defaultOptions));

      await act(async () => {
        await result.current.addFiles(fileList);
      });

      // 第一次状态更新
      const state1 = createMockFileState({ fileId, file, status: "uploading" });
      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: state1 });
      });

      expect(result.current.files).toHaveLength(1);

      // 第二次状态更新（相同文件ID）
      const state2 = createMockFileState({ fileId, file, status: "completed" });
      act(() => {
        eventEmitter.emit("stateChange", { fileId, state: state2 });
      });

      // 应该更新现有文件状态而不是添加新文件
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].status).toBe("completed");
    });
  });
});
