/**
 * 文件类型配置
 * 定义了支持的各种文件格式
 */

// 图片格式
export const IMAGE_TYPES = {
  // 常见图片格式
  COMMON: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/tif",
    "image/svg+xml",
    "image/ico",
    "image/x-icon",
  ],
  // 扩展名格式
  EXTENSIONS: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
    ".svg",
    ".ico",
    ".avif",
    ".heic",
    ".heif",
  ],
  // 原始格式
  RAW: [
    ".cr2", // Canon
    ".nef", // Nikon
    ".arw", // Sony
    ".dng", // Adobe
    ".orf", // Olympus
    ".rw2", // Panasonic
    ".pef", // Pentax
    ".srw", // Samsung
  ],
  // 设计格式
  DESIGN: [
    ".psd", // Photoshop
    ".ai", // Illustrator
    ".eps", // Encapsulated PostScript
    ".indd", // InDesign
    ".sketch", // Sketch
    ".fig", // Figma
    ".xd", // Adobe XD
  ],
};

// 视频格式
export const VIDEO_TYPES = {
  // 常见视频格式
  COMMON: [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/m4v",
    "video/3gp",
    "video/quicktime",
    "video/ogg",
    "video/x-msvideo",
    "video/x-ms-wmv",
    "video/x-flv",
  ],
  // 扩展名格式
  EXTENSIONS: [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".mkv",
    ".m4v",
    ".3gp",
    ".3g2",
    ".mts",
    ".m2ts",
    ".ts",
    ".vob",
    ".ogv",
    ".rm",
    ".rmvb",
    ".asf",
    ".divx",
    ".xvid",
    ".f4v",
    ".m2v",
    ".mpg",
    ".mpeg",
    ".mpv",
    ".qt",
  ],
  // 高分辨率格式
  HIGH_RES: [
    ".4k",
    ".8k",
    ".uhd",
    ".hdr",
    ".mxf", // 专业格式
    ".prores", // Apple ProRes
    ".dnxhd", // Avid DNxHD
    ".r3d", // RED
    ".braw", // Blackmagic RAW
  ],
};

// 音频格式
export const AUDIO_TYPES = {
  // 常见音频格式
  COMMON: [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/aac",
    "audio/flac",
    "audio/wma",
    "audio/m4a",
    "audio/webm",
    "audio/x-wav",
    "audio/x-ms-wma",
  ],
  // 扩展名格式
  EXTENSIONS: [
    ".mp3",
    ".wav",
    ".ogg",
    ".aac",
    ".flac",
    ".wma",
    ".m4a",
    ".ape",
    ".dsd",
    ".opus",
    ".aiff",
    ".au",
    ".ra",
    ".amr",
    ".ac3",
    ".dts",
    ".pcm",
  ],
  // 无损格式
  LOSSLESS: [".flac", ".ape", ".wav", ".aiff", ".dsd", ".pcm"],
};

// 文档格式
export const DOCUMENT_TYPES = {
  // Microsoft Office
  OFFICE: [
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".mdb",
    ".accdb",
    ".pub",
    ".vsd",
    ".vsdx",
  ],
  // PDF和文本
  TEXT: [
    ".pdf",
    ".txt",
    ".rtf",
    ".odt",
    ".ods",
    ".odp",
    ".pages",
    ".numbers",
    ".keynote",
  ],
  // 代码文件
  CODE: [
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".cs",
    ".php",
    ".rb",
    ".go",
    ".rust",
    ".swift",
    ".kt",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
  ],
  // 电子书
  EBOOK: [".epub", ".mobi", ".azw", ".azw3", ".fb2", ".lit", ".pdb"],
};

// 压缩格式
export const ARCHIVE_TYPES = {
  COMMON: [
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".tar.gz",
    ".tar.bz2",
    ".tar.xz",
    ".dmg",
    ".iso",
    ".cab",
    ".deb",
    ".rpm",
    ".msi",
  ],
};

// 3D和CAD格式
export const CAD_3D_TYPES = {
  CAD: [
    ".dwg",
    ".dxf",
    ".step",
    ".stp",
    ".iges",
    ".igs",
    ".sat",
    ".x_t",
    ".x_b",
  ],
  "3D": [
    ".obj",
    ".fbx",
    ".3ds",
    ".max",
    ".blend",
    ".dae",
    ".ply",
    ".stl",
    ".gltf",
    ".glb",
    ".usd",
    ".usdz",
  ],
};

// 数据库格式
export const DATABASE_TYPES = {
  COMMON: [
    ".db",
    ".sqlite",
    ".sqlite3",
    ".mdb",
    ".accdb",
    ".dbf",
    ".sql",
    ".bak",
  ],
};

// 字体格式
export const FONT_TYPES = {
  COMMON: [".ttf", ".otf", ".woff", ".woff2", ".eot", ".svg", ".pfb", ".pfm"],
};

// 预定义的组合类型
export const PREDEFINED_TYPES = {
  // 所有类型
  ALL: "*/*",

  // 所有图片
  ALL_IMAGES: [
    ...IMAGE_TYPES.COMMON,
    ...IMAGE_TYPES.EXTENSIONS,
    ...IMAGE_TYPES.RAW,
    ...IMAGE_TYPES.DESIGN,
  ],

  // 所有视频
  ALL_VIDEOS: [
    ...VIDEO_TYPES.COMMON,
    ...VIDEO_TYPES.EXTENSIONS,
    ...VIDEO_TYPES.HIGH_RES,
  ],

  // 所有音频
  ALL_AUDIO: [...AUDIO_TYPES.COMMON, ...AUDIO_TYPES.EXTENSIONS],

  // 所有文档
  ALL_DOCUMENTS: [
    ...DOCUMENT_TYPES.OFFICE,
    ...DOCUMENT_TYPES.TEXT,
    ...DOCUMENT_TYPES.CODE,
    ...DOCUMENT_TYPES.EBOOK,
  ],

  // 媒体文件（图片+视频+音频）
  MEDIA: [
    ...IMAGE_TYPES.COMMON,
    ...IMAGE_TYPES.EXTENSIONS,
    ...VIDEO_TYPES.COMMON,
    ...VIDEO_TYPES.EXTENSIONS,
    ...AUDIO_TYPES.COMMON,
    ...AUDIO_TYPES.EXTENSIONS,
  ],

  // 常用文件
  COMMON: [
    ...IMAGE_TYPES.EXTENSIONS.slice(0, 10), // 前10种图片格式
    ...VIDEO_TYPES.EXTENSIONS.slice(0, 10), // 前10种视频格式
    ...AUDIO_TYPES.EXTENSIONS.slice(0, 5), // 前5种音频格式
    ...DOCUMENT_TYPES.OFFICE,
    ...DOCUMENT_TYPES.TEXT,
    ".zip",
    ".rar",
    ".7z",
  ],
};

// 文件类型检测工具函数
export const FileTypeUtils = {
  /**
   * 检查文件是否为图片
   */
  isImage(file: File): boolean {
    return (
      IMAGE_TYPES.COMMON.includes(file.type) ||
      IMAGE_TYPES.EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      )
    );
  },

  /**
   * 检查文件是否为视频
   */
  isVideo(file: File): boolean {
    return (
      VIDEO_TYPES.COMMON.includes(file.type) ||
      VIDEO_TYPES.EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      )
    );
  },

  /**
   * 检查文件是否为音频
   */
  isAudio(file: File): boolean {
    return (
      AUDIO_TYPES.COMMON.includes(file.type) ||
      AUDIO_TYPES.EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      )
    );
  },

  /**
   * 检查文件是否为文档
   */
  isDocument(file: File): boolean {
    return (
      DOCUMENT_TYPES.OFFICE.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      ) ||
      DOCUMENT_TYPES.TEXT.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      ) ||
      DOCUMENT_TYPES.CODE.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  },

  /**
   * 获取文件类型分类
   */
  getFileCategory(
    file: File
  ): "image" | "video" | "audio" | "document" | "archive" | "other" {
    if (this.isImage(file)) return "image";
    if (this.isVideo(file)) return "video";
    if (this.isAudio(file)) return "audio";
    if (this.isDocument(file)) return "document";

    const fileName = file.name.toLowerCase();
    if (ARCHIVE_TYPES.COMMON.some((ext) => fileName.endsWith(ext))) {
      return "archive";
    }

    return "other";
  },

  /**
   * 获取文件扩展名
   */
  getFileExtension(filename: string): string {
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1] : "";
  },

  /**
   * 验证文件类型
   */
  validateFileType(file: File, acceptedTypes: string[]): boolean {
    if (!acceptedTypes || acceptedTypes.length === 0) return true;
    if (acceptedTypes.includes("*/*")) return true;

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const extension = this.getFileExtension(file.name);

    return acceptedTypes.some((accept) => {
      const acceptType = accept.toLowerCase();

      // 检查扩展名
      if (acceptType.startsWith(".")) {
        return acceptType === extension;
      }

      // 检查MIME类型
      if (acceptType.includes("/")) {
        // 支持通配符，如 image/*
        if (acceptType.endsWith("/*")) {
          const baseType = acceptType.replace("/*", "");
          return mimeType.startsWith(baseType);
        }
        return mimeType === acceptType;
      }

      return false;
    });
  },
};
