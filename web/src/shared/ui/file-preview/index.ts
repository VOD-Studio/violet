/**
 * 文件预览套件
 *
 * FilePreview：按文件类型自动分发的预览主组件
 * 各子预览（图片/占位）：单独导出可独立使用
 * 视频/音频预览见独立套件 @/shared/ui/video-preview、@/shared/ui/audio-preview
 */

// 子预览组件（可独立使用）
export { FilePlaceholder } from "./components/FilePlaceholder";
// 主分发器
export { FilePreview } from "./components/FilePreview";
export { FilePreviewImage } from "./components/ImagePreview";
export type { FilePreviewProps } from "./types/file-preview-types";

// 工具
export { formatFileSize, getFileInfo, getFileKind } from "./utils/mime-utils";
