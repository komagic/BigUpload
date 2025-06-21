/**
 * 测试工具函数
 */

import { FileUploadState, UploadProgress } from "../../core/BigUploadEngine";

/**
 * 创建Mock文件
 */
export function createMockFile(
  content: string = "test content",
  filename: string = "test.txt",
  type: string = "text/plain"
): File {
  return new File([content], filename, { type });
}

/**
 * 创建Mock FileList
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as FileList;
}

/**
 * 创建Mock文件状态
 */
export function createMockFileState(
  overrides: Partial<FileUploadState> = {}
): FileUploadState {
  const defaultProgress: UploadProgress = {
    loaded: 0,
    total: 100,
    percent: 0,
    speed: 0,
    remainingTime: 0,
    uploadedChunks: 0,
    totalChunks: 1,
  };

  return {
    fileId: "mock-file-id",
    file: createMockFile(),
    status: "pending",
    progress: defaultProgress,
    ...overrides,
  };
}

/**
 * 创建Mock进度数据
 */
export function createMockProgress(
  overrides: Partial<UploadProgress> = {}
): UploadProgress {
  return {
    loaded: 0,
    total: 100,
    percent: 0,
    speed: 0,
    remainingTime: 0,
    uploadedChunks: 0,
    totalChunks: 1,
    ...overrides,
  };
}

/**
 * 等待异步操作完成
 */
export function waitForAsync(timeout: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * 创建多个Mock文件
 */
export function createMockFiles(count: number): File[] {
  return Array.from({ length: count }, (_, index) =>
    createMockFile(`content ${index}`, `file${index}.txt`)
  );
}

/**
 * 断言工具 - 验证文件ID数组
 */
export function expectFileIds(actual: string[], expected: string[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((id) => {
    expect(actual).toContain(id);
  });
}

/**
 * 断言工具 - 验证进度对象
 */
export function expectProgress(
  actual: UploadProgress,
  expected: Partial<UploadProgress>
): void {
  Object.keys(expected).forEach((key) => {
    expect(actual[key as keyof UploadProgress]).toBe(
      expected[key as keyof UploadProgress]
    );
  });
}

/**
 * Mock BigUploadEngine 的工厂函数
 */
export function createMockEngine() {
  return {
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
  };
}

/**
 * 模拟事件触发器
 */
export class MockEventEmitter {
  private handlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);

    return () => {
      const handlers = this.handlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  emit(event: string, data?: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
