/**
 * 表情上传组件
 * 使用专用的表情上传接口，文件保存到独立目录 uploads/emojis/
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getUploadUrl } from "@/lib/api";

/** 表情上传结果 */
interface EmojiUploadResult {
  url: string;       // 相对路径，如 /uploads/emojis/xxx.png
  filename: string;  // 文件名
  size: number;      // 文件大小
  mime_type: string; // MIME 类型
}

/** 单个文件上传状态 */
interface FileUploadItem {
  /** 临时 ID */
  id: string;
  /** 文件对象 */
  file: File;
  /** 上传进度 0-100 */
  progress: number;
  /** 上传状态 */
  status: "pending" | "uploading" | "done" | "error";
  /** 上传结果 */
  result?: EmojiUploadResult;
  /** 错误信息 */
  error?: string;
}

/** EmojiUploader 组件属性 */
interface EmojiUploaderProps {
  /** 上传完成回调 */
  onUpload?: (result: EmojiUploadResult) => void;
  /** 自定义类名 */
  className?: string;
  /** 最大文件数量 */
  maxFiles?: number;
  /** 接受的文件类型 */
  accept?: Record<string, string[]>;
}

/** 接受的图片文件类型 */
const imageAccept: Record<string, string[]> = {
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
};

/** 单文件最大体积：10MB */
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * 生成临时唯一 ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 上传表情图片到专用接口
 */
async function uploadEmojiImage(file: File): Promise<EmojiUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const result = await api.post<EmojiUploadResult>("/admin/emojis/upload", formData);
  return result;
}

/**
 * 表情上传组件
 * 专门用于上传表情图片，限制文件类型和大小
 * 表情图片保存到独立目录，不进入素材库
 */
export default function EmojiUploader({
  onUpload,
  className = "",
  maxFiles = 10,
  accept = imageAccept,
}: EmojiUploaderProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);

  /**
   * 更新指定文件的上传状态
   */
  const updateItem = useCallback(
    (id: string, updates: Partial<FileUploadItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  /**
   * 执行单个文件上传
   */
  const handleUpload = useCallback(
    async (item: FileUploadItem) => {
      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        const result = await uploadEmojiImage(item.file);

        updateItem(item.id, { status: "done", progress: 100, result });
        onUpload?.(result);
        toast.success(`「${item.file.name}」上传成功`);
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "上传失败",
        });
        toast.error("上传失败，请重试");
      }
    },
    [updateItem, onUpload],
  );

  /**
   * 处理文件选择
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // 过滤非图片文件
      const imageFiles = acceptedFiles.filter((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFiles.length < acceptedFiles.length) {
        toast.warning("部分文件不是图片格式，已自动过滤");
      }

      const newItems: FileUploadItem[] = imageFiles.map((file) => ({
        id: generateId(),
        file,
        progress: 0,
        status: "pending" as const,
      }));

      setItems((prev) => [...prev, ...newItems]);

      // 开始上传
      for (const item of newItems) {
        handleUpload(item);
      }
    },
    [handleUpload],
  );

  /**
   * 移除上传项
   */
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * 清空已完成的上传项
   */
  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status !== "done"));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize: MAX_SIZE,
    maxFiles,
    multiple: maxFiles > 1,
  });

  const completedCount = items.filter((item) => item.status === "done").length;
  const hasCompleted = completedCount > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 拖拽上传区域 */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-1 h-6 w-6 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">松开鼠标上传表情</p>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium">拖拽或点击上传图片</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PNG、JPG、GIF、WebP、SVG，最大 10MB
            </p>
          </div>
        )}
      </div>

      {/* 上传列表 */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {hasCompleted ? `已完成 ${completedCount} 个` : `等待上传...`}
            </span>
            {hasCompleted && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                清空已完成
              </Button>
            )}
          </div>
          <div className="max-h-[200px] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                {/* 预览缩略图 */}
                <div className="flex-shrink-0">
                  {item.status === "done" && item.result ? (
                    <img
                      src={getUploadUrl(item.result.url)}
                      alt={item.file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      {item.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {item.status === "pending" && (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>

                {/* 文件信息和进度 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.file.name}</p>
                  {item.status === "uploading" && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === "error" && (
                    <p className="mt-0.5 text-xs text-destructive">
                      {item.error}
                    </p>
                  )}
                </div>

                {/* 移除按钮 */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(item.id)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 导出类型 */
export type { EmojiUploadResult };