import "@testing-library/jest-dom";

// Mock window.URL methods
global.URL = {
  ...global.URL,
  createObjectURL: jest.fn(() => "mock-url"),
  revokeObjectURL: jest.fn(),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Mock performance API
global.performance = {
  ...performance,
  now: jest.fn(() => Date.now()),
};

// Mock FileReader for consistent testing
const mockFileReader = () => {
  return {
    readAsArrayBuffer: jest.fn(),
    readAsText: jest.fn(),
    readAsDataURL: jest.fn(),
    onload: null,
    onerror: null,
    onabort: null,
    result: null,
  };
};

// Set up default FileReader mock
global.FileReader = jest.fn().mockImplementation(() => mockFileReader());

// Mock ResizeObserver for component testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Add custom matchers for better testing
expect.extend({
  toHaveValidFileSize(received, expected) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(expected) / Math.log(1024));
    const formattedSize =
      parseFloat((expected / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];

    if (received === formattedSize) {
      return {
        message: () => `expected ${received} not to be ${formattedSize}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be ${formattedSize}`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidFileSize(expected: number): R;
    }
  }
}

export {};
