/**
 * BigUpload Frontend Package
 * 大文件上传前端库 - 统一导出
 */

// 导入核心类型以在工具函数中使用
import { UploadConfig, BigUploadEngine } from "./core/BigUploadEngine";
import { FileTypeUtils } from "./constants/fileTypes";

// 核心引擎 - 纯逻辑，框架无关
export {
  BigUploadEngine,
  type UploadConfig,
  type FileUploadState,
  type UploadProgress,
  type UploadError,
  type UploadResult,
  type UploadEventType,
  type UploadEventHandler,
} from "./core/BigUploadEngine";

// 文件类型配置
export {
  IMAGE_TYPES,
  VIDEO_TYPES,
  AUDIO_TYPES,
  DOCUMENT_TYPES,
  ARCHIVE_TYPES,
  CAD_3D_TYPES,
  DATABASE_TYPES,
  FONT_TYPES,
  PREDEFINED_TYPES,
  FileTypeUtils,
} from "./constants/fileTypes";

// React Hook
export {
  useBigUpload,
  type UseBigUploadOptions,
  type UseBigUploadReturn,
} from "./hooks/useBigUpload";

// React 组件
export { BigUploader, type BigUploaderProps } from "./components/BigUploader";
// 为了向后兼容，导出FastUploader作为BigUploader的别名
export { BigUploader as FastUploader } from "./components/BigUploader";

// Ant Design 组件
export {
  BigAntUploader,
  type BigAntUploaderProps,
  type BigAntUploaderRef,
} from "./components/BigAntUploader";
// 为了向后兼容，导出AntUploader作为BigAntUploader的别名
export { BigAntUploader as AntUploader } from "./components/BigAntUploader";

// Vue 3 组件 (需要在Vue项目中使用，这里只导出类型)
// export { default as BigVueUploader } from "./components/BigVueUploader/index.vue";

// Hash 计算工具
export {
  HashWorkerManager,
  type HashProgress,
  type ChunkResult,
  type HashCalculationResult,
} from "./utils/HashWorkerManager";

export {
  SimpleHashCalculator,
  type SimpleHashResult,
} from "./utils/SimpleHashCalculator";

// 工具函数
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const validateFileType = (file: File, accept?: string[]): boolean => {
  return FileTypeUtils.validateFileType(file, accept || []);
};

// 版本信息
export const version = "1.0.0";

// 默认配置
export const defaultConfig: Partial<UploadConfig> = {
  chunkSize: 2 * 1024 * 1024, // 2MB
  concurrent: 3,
  retryCount: 3,
  retryDelay: 1000,
  debug: false,
};

/**
 * 快速创建上传引擎实例
 * @param baseUrl 后端API基础URL
 * @param options 可选配置
 * @returns BigUploadEngine实例
 */
export const createUploadEngine = (
  baseUrl: string,
  options?: Partial<UploadConfig>
): BigUploadEngine => {
  return new BigUploadEngine({
    baseUrl,
    ...defaultConfig,
    ...options,
  });
};
