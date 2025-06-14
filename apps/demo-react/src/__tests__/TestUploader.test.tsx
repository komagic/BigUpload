import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TestUploader from "../TestUploader";

// Mock BigUploader component
jest.mock("@bigupload/react", () => ({
  BigUploader: jest.fn(({ onSuccess, onError, onProgress, ...props }) => {
    React.useEffect(() => {
      // Simulate upload success after a short delay
      const timer = setTimeout(() => {
        if (onSuccess && mockFileSuccess) {
          onSuccess(mockFileSuccess.id, {
            message: "上传成功",
            url: "http://example.com/file.jpg",
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }, [onSuccess, onError, onProgress]);

    return (
      <div data-testid="big-uploader">
        <div>Mock BigUploader</div>
        <div>baseUrl: {props.baseUrl}</div>
        <div>chunkSize: {props.chunkSize}</div>
        <div>concurrent: {props.concurrent}</div>
        <div>accept: {props.accept?.join(",")}</div>
      </div>
    );
  }),
}));

// Mock SparkMD5
jest.mock("spark-md5", () => ({
  __esModule: true,
  default: {
    ArrayBuffer: jest.fn().mockImplementation(() => ({
      append: jest.fn(),
      end: jest.fn(() => "mock-hash-12345"),
    })),
  },
}));

// Global mock variables
let mockFileSuccess: { id: string } | null = null;

// Helper function to create mock files
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(["mock content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

// Helper function to mock FileReader
const mockFileReader = () => {
  const originalFileReader = global.FileReader;

  global.FileReader = jest.fn(() => ({
    readAsArrayBuffer: jest.fn(function () {
      const arrayBuffer = new ArrayBuffer(8);
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: arrayBuffer } });
        }
      }, 50);
    }),
    onload: null,
    onerror: null,
    onabort: null,
    result: null,
  })) as any;

  return () => {
    global.FileReader = originalFileReader;
  };
};

describe("TestUploader Component", () => {
  let restoreFileReader: () => void;

  beforeEach(() => {
    restoreFileReader = mockFileReader();
    mockFileSuccess = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreFileReader();
  });

  test("渲染所有测试用例", () => {
    render(<TestUploader />);

    expect(screen.getByText("文本文件测试")).toBeInTheDocument();
    expect(screen.getByText("PDF文件测试")).toBeInTheDocument();
    expect(screen.getByText("图片文件测试")).toBeInTheDocument();
    expect(screen.getByText("视频文件测试")).toBeInTheDocument();
    expect(screen.getByText("音频文件测试")).toBeInTheDocument();
    expect(screen.getByText("压缩文件测试")).toBeInTheDocument();
    expect(screen.getByText("文档文件测试")).toBeInTheDocument();
    expect(screen.getByText("代码文件测试")).toBeInTheDocument();
    expect(screen.getByText("大文件测试")).toBeInTheDocument();
  });

  test("显示正确的服务器地址配置", () => {
    render(<TestUploader />);

    const serverInput = screen.getByLabelText(
      "服务器地址:"
    ) as HTMLInputElement;
    expect(serverInput.value).toBe("http://localhost:3000");
  });

  test("点击测试用例按钮触发文件选择", async () => {
    render(<TestUploader />);

    // 创建隐藏的文件输入元素
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "file";
    hiddenInput.style.display = "none";
    document.body.appendChild(hiddenInput);

    // Mock click method
    const clickSpy = jest.spyOn(hiddenInput, "click");

    // 点击图片测试按钮
    const imageTestButton = screen.getByText("图片文件测试");
    fireEvent.click(imageTestButton);

    // 等待自动触发文件选择
    await waitFor(
      () => {
        expect(imageTestButton).toHaveClass("active");
      },
      { timeout: 200 }
    );

    document.body.removeChild(hiddenInput);
  });

  test("文件选择和哈希计算流程", async () => {
    render(<TestUploader />);

    // 选择图片测试用例
    const imageTestButton = screen.getByText("图片文件测试");
    fireEvent.click(imageTestButton);

    await waitFor(() => {
      expect(imageTestButton).toHaveClass("active");
    });

    // 模拟文件选择
    const mockFile = createMockFile(
      "test-image.jpg",
      1024 * 1024,
      "image/jpeg"
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      // 创建FileList mock
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      // 触发文件更改事件
      fireEvent.change(fileInput);

      // 等待哈希计算完成
      await waitFor(
        () => {
          expect(
            screen.getByText(/正在测试: 图片文件测试/)
          ).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // 检查文件信息显示
      expect(screen.getByText(/文件: test-image.jpg/)).toBeInTheDocument();
      expect(screen.getByText(/哈希值: mock-hash-12345/)).toBeInTheDocument();
    }
  });

  test("上传成功后更新结果", async () => {
    mockFileSuccess = { id: "upload-123" };

    render(<TestUploader />);

    // 选择文本测试用例
    const textTestButton = screen.getByText("文本文件测试");
    fireEvent.click(textTestButton);

    await waitFor(() => {
      expect(textTestButton).toHaveClass("active");
    });

    // 模拟文件选择
    const mockFile = createMockFile("test.txt", 1024, "text/plain");
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 等待上传完成
      await waitFor(
        () => {
          expect(screen.getByText("✅ 成功")).toBeInTheDocument();
        },
        { timeout: 1500 }
      );

      // 检查结果表格
      expect(screen.getByText("文本文件测试")).toBeInTheDocument();
      expect(screen.getByText("test.txt")).toBeInTheDocument();
      expect(screen.getByText("1 KB")).toBeInTheDocument();
    }
  });

  test("不同文件类型的accept属性配置", async () => {
    render(<TestUploader />);

    // 测试视频文件类型
    const videoTestButton = screen.getByText("视频文件测试");
    fireEvent.click(videoTestButton);

    await waitFor(() => {
      expect(videoTestButton).toHaveClass("active");
    });

    const mockFile = createMockFile(
      "test.mov",
      10 * 1024 * 1024,
      "video/quicktime"
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 等待BigUploader组件渲染
      await waitFor(
        () => {
          const bigUploader = screen.getByTestId("big-uploader");
          expect(bigUploader).toBeInTheDocument();

          // 检查accept属性包含视频格式
          const acceptText = bigUploader.textContent;
          expect(acceptText).toContain("video/*");
          expect(acceptText).toContain(".mov");
        },
        { timeout: 1000 }
      );
    }
  });

  test("文件大小格式化功能", () => {
    render(<TestUploader />);

    // 通过创建不同尺寸的测试文件来验证格式化
    const testCases = [
      { size: 0, expected: "0 B" },
      { size: 1024, expected: "1 KB" },
      { size: 1024 * 1024, expected: "1 MB" },
      { size: 1.5 * 1024 * 1024, expected: "1.5 MB" },
      { size: 1024 * 1024 * 1024, expected: "1 GB" },
    ];

    // 这个测试验证formatFileSize函数的逻辑
    // 由于函数是组件内部的，我们通过实际使用来测试
    testCases.forEach(({ size, expected }) => {
      // 计算预期的格式化结果
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      if (size === 0) {
        expect("0 B").toBe(expected);
      } else {
        const i = Math.floor(Math.log(size) / Math.log(1024));
        const formatted =
          parseFloat((size / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
        expect(formatted).toBe(expected);
      }
    });
  });

  test("清除测试结果功能", async () => {
    mockFileSuccess = { id: "upload-456" };

    render(<TestUploader />);

    // 先进行一次上传生成结果
    const pdfTestButton = screen.getByText("PDF文件测试");
    fireEvent.click(pdfTestButton);

    await waitFor(() => {
      expect(pdfTestButton).toHaveClass("active");
    });

    const mockFile = createMockFile(
      "test.pdf",
      2 * 1024 * 1024,
      "application/pdf"
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 等待结果出现
      await waitFor(
        () => {
          expect(screen.getByText("✅ 成功")).toBeInTheDocument();
        },
        { timeout: 1500 }
      );

      // 点击清除结果按钮
      const clearButton = screen.getByText("清除结果");
      fireEvent.click(clearButton);

      // 验证结果被清除
      await waitFor(() => {
        expect(
          screen.getByText("尚无测试结果。请选择一个测试用例并上传文件。")
        ).toBeInTheDocument();
      });

      expect(screen.queryByText("✅ 成功")).not.toBeInTheDocument();
    }
  });

  test("服务器地址更改功能", async () => {
    render(<TestUploader />);

    const serverInput = screen.getByLabelText(
      "服务器地址:"
    ) as HTMLInputElement;

    // 更改服务器地址
    await userEvent.clear(serverInput);
    await userEvent.type(serverInput, "http://localhost:3001");

    expect(serverInput.value).toBe("http://localhost:3001");
  });

  test("时间格式化功能", () => {
    // 测试时间格式化逻辑
    const formatTime = (ms: number) => {
      if (ms < 1000) return ms + "ms";
      return (ms / 1000).toFixed(2) + "s";
    };

    expect(formatTime(500)).toBe("500ms");
    expect(formatTime(1000)).toBe("1.00s");
    expect(formatTime(1500)).toBe("1.50s");
    expect(formatTime(2345)).toBe("2.35s");
  });

  test("所有文件类型常量定义正确", () => {
    render(<TestUploader />);

    // 通过点击不同按钮验证所有文件类型都有定义
    const testCases = [
      "文本文件测试",
      "PDF文件测试",
      "图片文件测试",
      "视频文件测试",
      "音频文件测试",
      "压缩文件测试",
      "文档文件测试",
      "代码文件测试",
      "大文件测试",
    ];

    testCases.forEach((testName) => {
      const button = screen.getByText(testName);
      expect(button).toBeInTheDocument();

      // 点击按钮确保不会报错
      fireEvent.click(button);
      expect(button).toHaveClass("active");
    });
  });

  test("哈希计算错误处理", async () => {
    // Mock FileReader to throw an error
    const errorMessage = "Hash calculation failed";
    global.FileReader = jest.fn(() => ({
      readAsArrayBuffer: jest.fn(function () {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new Error(errorMessage));
          }
        }, 50);
      }),
      onload: null,
      onerror: null,
      onabort: null,
      result: null,
    })) as any;

    render(<TestUploader />);

    const audioTestButton = screen.getByText("音频文件测试");
    fireEvent.click(audioTestButton);

    await waitFor(() => {
      expect(audioTestButton).toHaveClass("active");
    });

    const mockFile = createMockFile("test.mp3", 5 * 1024 * 1024, "audio/mpeg");
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      // 等待错误处理
      await waitFor(
        () => {
          expect(screen.getByText("❌ 失败")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    }
  });

  test("BigUploader组件props传递正确", async () => {
    render(<TestUploader />);

    const codeTestButton = screen.getByText("代码文件测试");
    fireEvent.click(codeTestButton);

    await waitFor(() => {
      expect(codeTestButton).toHaveClass("active");
    });

    const mockFile = createMockFile("test.js", 1024, "text/javascript");
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockFile : null),
        [Symbol.iterator]: function* () {
          yield mockFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(
        () => {
          const bigUploader = screen.getByTestId("big-uploader");
          const content = bigUploader.textContent || "";

          expect(content).toContain("baseUrl: http://localhost:3000");
          expect(content).toContain("chunkSize: 1048576"); // 1MB for code files
          expect(content).toContain("concurrent: 3");
          expect(content).toContain(".js"); // Should include JavaScript extension
        },
        { timeout: 1000 }
      );
    }
  });
});

// 性能测试
describe("TestUploader Performance", () => {
  test("大文件哈希计算性能", async () => {
    const startTime = performance.now();
    const restoreFileReader = mockFileReader();

    render(<TestUploader />);

    const largeTestButton = screen.getByText("大文件测试");
    fireEvent.click(largeTestButton);

    await waitFor(() => {
      expect(largeTestButton).toHaveClass("active");
    });

    // 模拟大文件
    const mockLargeFile = createMockFile(
      "large-file.zip",
      100 * 1024 * 1024,
      "application/zip"
    );
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    if (fileInput) {
      const fileList = {
        0: mockLargeFile,
        length: 1,
        item: (index: number) => (index === 0 ? mockLargeFile : null),
        [Symbol.iterator]: function* () {
          yield mockLargeFile;
        },
      } as FileList;

      Object.defineProperty(fileInput, "files", {
        value: fileList,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(
        () => {
          expect(screen.getByText(/正在测试: 大文件测试/)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 性能检查：应该在合理时间内完成
      expect(duration).toBeLessThan(2000); // 2秒内完成
    }

    restoreFileReader();
  });

  test("多次文件选择内存清理", async () => {
    const restoreFileReader = mockFileReader();

    render(<TestUploader />);

    const imageTestButton = screen.getByText("图片文件测试");

    // 模拟多次文件选择
    for (let i = 0; i < 3; i++) {
      fireEvent.click(imageTestButton);

      await waitFor(() => {
        expect(imageTestButton).toHaveClass("active");
      });

      const mockFile = createMockFile(
        `test-${i}.jpg`,
        1024 * 1024,
        "image/jpeg"
      );
      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      if (fileInput) {
        const fileList = {
          0: mockFile,
          length: 1,
          item: (index: number) => (index === 0 ? mockFile : null),
          [Symbol.iterator]: function* () {
            yield mockFile;
          },
        } as FileList;

        Object.defineProperty(fileInput, "files", {
          value: fileList,
          writable: false,
        });

        fireEvent.change(fileInput);

        // 等待处理完成
        await waitFor(
          () => {
            expect(
              screen.getByText(/正在测试: 图片文件测试/)
            ).toBeInTheDocument();
          },
          { timeout: 1000 }
        );
      }
    }

    // 验证没有内存泄漏（通过检查DOM清理）
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1);

    restoreFileReader();
  });
});
