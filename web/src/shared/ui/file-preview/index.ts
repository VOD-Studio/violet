/**
 * 文件预览套件
 *
 * FilePreview：按文件类型自动分发的预览主组件
 * 各子预览（图片/占位）：单独导出可独立使用
 * 视频/音频/PDF/文档/压缩包/代码/Markdown 预览见各自独立套件
 */

// 子预览组件（可独立使用）
export { ContentImage } from "./components/ContentImage";
export { FilePlaceholder } from "./components/FilePlaceholder";
// 主分发器
export { FilePreview } from "./components/FilePreview";
export type { FilePreviewProps } from "./types/file-preview-types";

// 工具
export { formatFileSize, getFileInfo, getFileKind } from "./utils/mime-utils";
