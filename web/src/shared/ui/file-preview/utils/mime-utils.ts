import type { LucideIcon } from "lucide-react";
import {
    File,
    FileArchive,
    FileSpreadsheet,
    FileText,
    ImageIcon,
    Music,
    Presentation,
    Video,
} from "lucide-react";

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/** 文件类型大类，用于 FilePreview 分发路由 */
export type FileKind =
    | "image"
    | "video"
    | "audio"
    | "pdf"
    | "docx"
    | "spreadsheet"
    | "presentation"
    | "archive"
    | "markdown"
    | "code"
    | "text"
    | "other";

/**
 * 根据 MIME 类型 + 文件名判断文件大类（预览分发用）
 */
export function getFileKind(mimeType: string, name?: string): FileKind {
    const ext = getExtension(name);
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.includes("pdf")) return "pdf";
    // Word: .docx 可预览，老式 .doc 二进制走占位
    if (mimeType.includes("word") || mimeType.includes("document") || ext === "docx") {
        return ext === "doc" ? "other" : "docx";
    }
    if (mimeType.includes("excel") || mimeType.includes("sheet") || ext === "xlsx") {
        return "spreadsheet";
    }
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation") || ext === "pptx") {
        return "presentation";
    }
    if (
        mimeType.includes("zip") ||
        mimeType.includes("rar") ||
        mimeType.includes("7z") ||
        mimeType.includes("tar") ||
        mimeType.includes("gz") ||
        ["zip", "rar", "7z", "tar", "gz"].includes(ext)
    ) {
        return "archive";
    }
    if (ext === "md" || ext === "markdown") return "markdown";
    if (isCodeExtension(ext)) return "code";
    if (mimeType.startsWith("text/")) return "text";
    return "other";
}

/** 提取文件扩展名（小写，不含点） */
export function getExtension(name?: string): string {
    if (!name) return "";
    const idx = name.lastIndexOf(".");
    return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

/** 代码文件扩展名集合 */
const CODE_EXTENSIONS = new Set([
    "js",
    "jsx",
    "ts",
    "tsx",
    "mjs",
    "cjs",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "py",
    "rb",
    "php",
    "c",
    "h",
    "cpp",
    "hpp",
    "cc",
    "cs",
    "scss",
    "sass",
    "less",
    "css",
    "html",
    "xml",
    "vue",
    "svelte",
    "json",
    "yml",
    "yaml",
    "toml",
    "ini",
    "conf",
    "sh",
    "bash",
    "zsh",
    "sql",
    "lua",
]);

/** 判断扩展名是否为代码文件 */
export function isCodeExtension(ext: string): boolean {
    return CODE_EXTENSIONS.has(ext);
}

/**
 * 根据 MIME 类型获取文件图标和描述（占位/信息展示用）
 */
export function getFileInfo(
    mimeType: string,
    name?: string,
): {
    icon: LucideIcon;
    label: string;
} {
    const kind = getFileKind(mimeType, name);
    switch (kind) {
        case "pdf":
            return { icon: FileText, label: "PDF 文档" };
        case "docx":
            return { icon: FileText, label: "Word 文档" };
        case "spreadsheet":
            return { icon: FileSpreadsheet, label: "Excel 表格" };
        case "presentation":
            return { icon: Presentation, label: "演示文稿" };
        case "archive":
            return getArchiveLabel(name);
        case "markdown":
            return { icon: FileText, label: "Markdown 文档" };
        case "code":
            return { icon: FileText, label: "代码文件" };
        case "text":
            return { icon: FileText, label: "文本文件" };
        case "video":
            return { icon: Video, label: "视频文件" };
        case "audio":
            return { icon: Music, label: "音频文件" };
        case "image":
            return { icon: ImageIcon, label: "图片文件" };
        default:
            return { icon: File, label: "文件" };
    }
}

/** 压缩包细分类型标签 */
function getArchiveLabel(name?: string): { icon: LucideIcon; label: string } {
    switch (getExtension(name)) {
        case "rar":
            return { icon: FileArchive, label: "RAR 压缩包" };
        case "7z":
            return { icon: FileArchive, label: "7Z 压缩包" };
        case "tar":
            return { icon: FileArchive, label: "TAR 归档" };
        case "gz":
            return { icon: FileArchive, label: "GZ 压缩包" };
        default:
            return { icon: FileArchive, label: "ZIP 压缩包" };
    }
}
