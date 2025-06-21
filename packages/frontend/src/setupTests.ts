/**
 * 测试环境设置
 */

import "@testing-library/jest-dom";

// Mock TextEncoder/TextDecoder
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;

// Mock File 构造函数 - 支持在测试环境中创建File对象
(global as any).File = class MockFile implements File {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string = "";

  constructor(bits: BlobPart[], name: string, options: FilePropertyBag = {}) {
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified || Date.now();

    // 计算文件大小
    this.size = bits.reduce((total, bit) => {
      if (typeof bit === "string") {
        return total + new TextEncoder().encode(bit).length;
      } else if (bit instanceof ArrayBuffer) {
        return total + bit.byteLength;
      } else if (bit instanceof Uint8Array) {
        return total + bit.length;
      }
      return total;
    }, 0);
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }

  bytes(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(this.size));
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob([], { type: contentType });
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream();
  }

  text(): Promise<string> {
    return Promise.resolve("");
  }
};

// Mock FileList
(global as any).FileList = class MockFileList {
  [index: number]: File;
  length: number;

  constructor(files: File[]) {
    this.length = files.length;
    files.forEach((file, index) => {
      this[index] = file;
    });
  }

  item(index: number): File | null {
    return this[index] || null;
  }

  *[Symbol.iterator](): Iterator<File> {
    for (let i = 0; i < this.length; i++) {
      yield this[i];
    }
  }
};

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    digest: () => Promise.resolve(new ArrayBuffer(32)),
  },
};

Object.defineProperty(global, "crypto", {
  value: mockCrypto,
});

// Mock navigator.hardwareConcurrency
Object.defineProperty(navigator, "hardwareConcurrency", {
  value: 4,
  writable: true,
});
