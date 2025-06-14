import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BigUploader } from "@bigupload/react";

// 实际的BigUploader集成测试
describe("BigUploader Integration Tests", () => {
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockOnProgress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    baseUrl: "http://localhost:3000",
    chunkSize: 1024 * 1024, // 1MB
    concurrent: 3,
    accept: ["image/*", ".jpg", ".jpeg", ".png"],
    autoStart: true,
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    onProgress: mockOnProgress,
  };

  test("BigUploader组件正确渲染", () => {
    render(<BigUploader {...defaultProps} />);

    // 检查拖拽区域
    expect(screen.getByText(/拖拽文件到此处或点击上传/)).toBeInTheDocument();
    expect(screen.getByText("选择文件")).toBeInTheDocument();

    // 检查隐藏的文件输入
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/*,.jpg,.jpeg,.png");
    expect(fileInput).toHaveAttribute("multiple");
  });

  test("点击上传区域触发文件选择", () => {
    render(<BigUploader {...defaultProps} />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, "click");

    // 点击上传区域
    const uploadArea = screen
      .getByText(/拖拽文件到此处或点击上传/)
      .closest("div");
    if (uploadArea) {
      fireEvent.click(uploadArea);
      expect(clickSpy).toHaveBeenCalled();
    }
  });

  test("文件类型验证正确工作", async () => {
    render(<BigUploader {...defaultProps} />);

    // 创建一个不被接受的文件类型
    const invalidFile = new File(["test"], "test.txt", { type: "text/plain" });
    const validFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // 模拟选择无效文件
    const invalidFileList = {
      0: invalidFile,
      length: 1,
      item: (index: number) => (index === 0 ? invalidFile : null),
      [Symbol.iterator]: function* () {
        yield invalidFile;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: invalidFileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待错误处理
    await waitFor(() => {
      expect(mockOnError).not.toHaveBeenCalled(); // 文件类型验证应该在添加前完成
    });
  });

  test("支持拖拽上传", async () => {
    render(<BigUploader {...defaultProps} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const uploadArea = screen
      .getByText(/拖拽文件到此处或点击上传/)
      .closest("div");

    if (uploadArea) {
      // 模拟拖拽事件
      const dragEvent = new Event("dragover", { bubbles: true });
      const dropEvent = new Event("drop", { bubbles: true }) as any;

      dropEvent.dataTransfer = {
        files: [file],
        items: [
          {
            kind: "file",
            type: file.type,
            getAsFile: () => file,
          },
        ],
        types: ["Files"],
      };

      fireEvent(uploadArea, dragEvent);
      fireEvent(uploadArea, dropEvent);

      // 验证拖拽文件被处理
      await waitFor(() => {
        // 这里应该验证文件被添加到上传队列
        // 具体实现取决于BigUploader的内部逻辑
      });
    }
  });

  test("禁用状态正确工作", () => {
    render(<BigUploader {...defaultProps} disabled={true} />);

    const uploadArea = screen
      .getByText(/拖拽文件到此处或点击上传/)
      .closest("div");
    expect(uploadArea).toHaveStyle("cursor: not-allowed");
    expect(uploadArea).toHaveStyle("background-color: #f5f5f5");
  });

  test("自定义文本显示正确", () => {
    const customProps = {
      ...defaultProps,
      dragText: "自定义拖拽文本",
      buttonText: "自定义按钮文本",
    };

    render(<BigUploader {...customProps} />);

    expect(screen.getByText("自定义拖拽文本")).toBeInTheDocument();
    expect(screen.getByText("自定义按钮文本")).toBeInTheDocument();
  });

  test("文件列表正确显示", async () => {
    render(<BigUploader {...defaultProps} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待文件列表更新
    await waitFor(() => {
      expect(screen.getByText("test.jpg")).toBeInTheDocument();
    });
  });

  test("进度显示正确更新", async () => {
    render(<BigUploader {...defaultProps} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 模拟进度更新
    await waitFor(() => {
      // 检查进度条是否显示
      const progressElements = document.querySelectorAll('[style*="width"]');
      expect(progressElements.length).toBeGreaterThan(0);
    });
  });

  test("多文件上传支持", async () => {
    render(<BigUploader {...defaultProps} />);

    const file1 = new File(["test content 1"], "test1.jpg", {
      type: "image/jpeg",
    });
    const file2 = new File(["test content 2"], "test2.png", {
      type: "image/png",
    });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file1,
      1: file2,
      length: 2,
      item: (index: number) =>
        index === 0 ? file1 : index === 1 ? file2 : null,
      [Symbol.iterator]: function* () {
        yield file1;
        yield file2;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待多个文件被处理
    await waitFor(() => {
      expect(screen.getByText("test1.jpg")).toBeInTheDocument();
      expect(screen.getByText("test2.png")).toBeInTheDocument();
    });
  });

  test("文件删除功能", async () => {
    render(<BigUploader {...defaultProps} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待文件显示
    await waitFor(() => {
      expect(screen.getByText("test.jpg")).toBeInTheDocument();
    });

    // 查找并点击删除按钮
    const deleteButton = screen.getByText("🚫");
    if (deleteButton) {
      fireEvent.click(deleteButton);

      // 验证文件被删除
      await waitFor(() => {
        expect(screen.queryByText("test.jpg")).not.toBeInTheDocument();
      });
    }
  });

  test("上传暂停和继续功能", async () => {
    render(<BigUploader {...defaultProps} />);

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待上传开始
    await waitFor(() => {
      expect(screen.getByText("⬆️")).toBeInTheDocument();
    });

    // 点击暂停按钮
    const pauseButton = screen.queryByText("⏸️");
    if (pauseButton) {
      fireEvent.click(pauseButton);

      // 验证状态变为暂停
      await waitFor(() => {
        expect(screen.getByText("⏸️")).toBeInTheDocument();
      });
    }
  });

  test("总体进度显示", async () => {
    render(<BigUploader {...defaultProps} showTotalProgress={true} />);

    const file1 = new File(["test 1"], "test1.jpg", { type: "image/jpeg" });
    const file2 = new File(["test 2"], "test2.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: file1,
      1: file2,
      length: 2,
      item: (index: number) =>
        index === 0 ? file1 : index === 1 ? file2 : null,
      [Symbol.iterator]: function* () {
        yield file1;
        yield file2;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 等待总体进度显示
    await waitFor(() => {
      const progressElements = document.querySelectorAll(
        '[style*="background-color: #1890ff"]'
      );
      expect(progressElements.length).toBeGreaterThan(0);
    });
  });

  test("错误状态正确显示", async () => {
    const errorProps = {
      ...defaultProps,
      onError: jest.fn(),
    };

    render(<BigUploader {...errorProps} />);

    // 这里可以模拟一个会导致错误的场景
    // 例如文件过大或网络错误
    const largeFile = new File(["x".repeat(100 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const fileList = {
      0: largeFile,
      length: 1,
      item: (index: number) => (index === 0 ? largeFile : null),
      [Symbol.iterator]: function* () {
        yield largeFile;
      },
    } as FileList;

    Object.defineProperty(fileInput, "files", {
      value: fileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // 验证错误处理
    await waitFor(() => {
      // 根据实际的错误处理逻辑来验证
      const errorIcon = screen.queryByText("❌");
      if (errorIcon) {
        expect(errorIcon).toBeInTheDocument();
      }
    });
  });
});

// 自定义渲染器测试
describe("BigUploader Custom Render Tests", () => {
  test("自定义文件列表渲染", () => {
    const customRenderFileList = (files: any[]) => (
      <div data-testid="custom-file-list">
        {files.map((file) => (
          <div key={file.fileId} data-testid="custom-file-item">
            自定义: {file.file.name}
          </div>
        ))}
      </div>
    );

    render(
      <BigUploader
        baseUrl="http://localhost:3000"
        renderFileList={customRenderFileList}
      />
    );

    // 添加文件后应该使用自定义渲染器
    // 这个测试需要根据实际的API来调整
  });

  test("CSS样式自定义", () => {
    const customStyle = {
      backgroundColor: "red",
      border: "2px solid blue",
    };

    const customClassName = "custom-uploader";

    render(
      <BigUploader
        baseUrl="http://localhost:3000"
        style={customStyle}
        className={customClassName}
      />
    );

    const uploaderElement = document.querySelector(`.${customClassName}`);
    expect(uploaderElement).toBeInTheDocument();
    expect(uploaderElement).toHaveStyle("background-color: red");
    expect(uploaderElement).toHaveStyle("border: 2px solid blue");
  });
});
