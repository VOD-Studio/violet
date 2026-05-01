// 文件预览组件
// 支持图片、视频、音频、PDF 预览，其他文件类型显示图标和下载

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File,
  Download,
  Music,
  Video,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";

/** 文件预览属性 */
interface FilePreviewProps {
  /** 文件完整 URL */
  url: string;
  /** 缩略图 URL（用于图片预览占位） */
  thumbnailUrl?: string;
  /** 文件 MIME 类型 */
  mimeType: string;
  /** 文件名称 */
  name?: string;
  /** 文件大小（字节） */
  size?: number;
  /** 是否显示文件信息 */
  showInfo?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 延迟渲染时间（毫秒），用于等待父容器动画完成 */
  delay?: number;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * 根据 MIME 类型获取文件图标和描述
 */
function getFileInfo(mimeType: string): { icon: typeof File; label: string } {
  if (mimeType.includes("pdf")) return { icon: FileText, label: "PDF 文档" };
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { icon: FileText, label: "Word 文档" };
  if (mimeType.includes("excel") || mimeType.includes("sheet"))
    return { icon: FileSpreadsheet, label: "Excel 表格" };
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return { icon: Presentation, label: "演示文稿" };
  if (mimeType.includes("zip"))
    return { icon: FileArchive, label: "ZIP 压缩包" };
  if (mimeType.includes("rar"))
    return { icon: FileArchive, label: "RAR 压缩包" };
  if (mimeType.includes("7z")) return { icon: FileArchive, label: "7Z 压缩包" };
  if (mimeType.includes("tar")) return { icon: FileArchive, label: "TAR 归档" };
  if (mimeType.includes("gz")) return { icon: FileArchive, label: "GZ 压缩包" };
  if (mimeType.startsWith("video/")) return { icon: Video, label: "视频文件" };
  if (mimeType.startsWith("audio/")) return { icon: Music, label: "音频文件" };
  if (mimeType.startsWith("image/"))
    return { icon: ImageIcon, label: "图片文件" };
  return { icon: File, label: "文件" };
}

/**
 * 图片预览，支持缩略图占位、加载态和错误态
 * 缩略图立即显示，delay结束后加载原图
 */
function ImagePreview({
  url,
  thumbnailUrl,
  name,
  delay = 0,
}: {
  url: string;
  thumbnailUrl?: string;
  name?: string;
  delay?: number;
}) {
  const [loadOriginal, setLoadOriginal] = useState(delay === 0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  // delay结束后加载原图
  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setLoadOriginal(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className="relative flex min-h-50 items-center justify-center bg-black/5">
      {/* 缩略图（始终显示直到原图加载完成） */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={name ?? "预览图片"}
          className={`max-h-125 w-full object-contain blur-sm transition-opacity duration-300 ${status === "loaded" ? "opacity-0" : "opacity-100"}`}
        />
      )}
      {/* 加载态（无缩略图时显示） */}
      {!thumbnailUrl && status === "loading" && (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      )}
      {/* 错误态 */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="size-8" />
          <span className="text-sm">图片加载失败</span>
        </div>
      )}
      {/* 原图（delay结束后才开始加载） */}
      {loadOriginal && (
        <img
          src={url}
          alt={name ?? "预览图片"}
          className={`absolute max-h-125 w-full object-contain transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}

/**
 * 视频预览，使用原生 HTML5 video + 自定义控制栏样式
 */
function VideoPreview({ url, mimeType }: { url: string; mimeType: string }) {
  return (
    <div className="bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        className="max-h-125 w-full"
      >
        <source src={url} type={mimeType} />
        您的浏览器不支持此视频格式
      </video>
    </div>
  );
}

/**
 * 音频预览，带图标装饰
 */
function AudioPreview({
  url,
  mimeType,
  name,
}: {
  url: string;
  mimeType: string;
  name?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Music className="size-8 text-primary" />
      </div>
      {name && <p className="max-w-75 truncate text-sm font-medium">{name}</p>}
      <audio controls preload="metadata" className="w-full max-w-md">
        <source src={url} type={mimeType} />
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
}

/**
 * 不可预览文件的占位展示，显示图标、类型和下载按钮
 */
function FilePlaceholder({
  url,
  name,
  mimeType,
}: {
  url: string;
  name?: string;
  mimeType: string;
}) {
  const { icon: Icon, label } = getFileInfo(mimeType);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = url;
    a.download = name ?? "download";
    a.click();
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {name && (
          <p className="mt-1 max-w-70 truncate text-xs text-muted-foreground">
            {name}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 size-3.5" />
        下载文件
      </Button>
    </div>
  );
}

/**
 * 文件预览组件
 * 根据文件类型展示对应的预览界面
 */
export default function FilePreview({
  url,
  thumbnailUrl,
  mimeType,
  name,
  size,
  showInfo = true,
  className = "",
  delay = 0,
}: FilePreviewProps) {
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");
  const isPDF = mimeType.includes("pdf");

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 预览区域 */}
      <div className="overflow-hidden rounded-lg border bg-background">
        {isImage && (
          <ImagePreview
            url={url}
            thumbnailUrl={thumbnailUrl}
            name={name}
            delay={delay}
          />
        )}
        {isVideo && <VideoPreview url={url} mimeType={mimeType} />}
        {isAudio && <AudioPreview url={url} mimeType={mimeType} name={name} />}
        {isPDF && (
          <iframe
            src={url}
            title={name ?? "PDF 预览"}
            className="h-150 w-full"
          />
        )}
        {!isImage && !isVideo && !isAudio && !isPDF && (
          <FilePlaceholder url={url} name={name} mimeType={mimeType} />
        )}
      </div>

      {/* 文件信息 */}
      {showInfo && name && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span className="truncate">{name}</span>
          {size !== undefined && (
            <span className="ml-2 shrink-0">{formatFileSize(size)}</span>
          )}
        </div>
      )}
    </div>
  );
}
