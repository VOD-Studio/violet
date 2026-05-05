/**
 * 评论图片上传组件
 * 参考哔哩哔哩的实现，支持图片选择、预览、删除
 */

import { useRef, useState, useCallback } from "react";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/components/upload/ChunkedUpload";
import type { CommentPicture } from "../types";
import { getUploadUrl } from "@/lib/api";

interface CommentImageUploadProps {
  /** 已上传的图片列表 */
  images: CommentPicture[];
  /** 图片变化回调 */
  onChange: (images: CommentPicture[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大图片数量 */
  maxCount?: number;
}

interface UploadingImage {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

/**
 * 评论图片上传组件
 * 支持点击选择图片、预览缩略图、删除图片
 */
export function CommentImageUpload({
  images,
  onChange,
  disabled = false,
  maxCount = 9,
}: CommentImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // 检查数量限制
      const totalCount = images.length + uploadingImages.length + files.length;
      if (totalCount > maxCount) {
        alert(`最多只能上传 ${maxCount} 张图片`);
        return;
      }

      // 创建上传任务
      const newUploading: UploadingImage[] = files.map((file) => ({
        id: Math.random().toString(36).slice(2),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadingImages((prev) => [...prev, ...newUploading]);

      // 开始上传
      for (const item of newUploading) {
        try {
          // 使用现有的分片上传系统，指定 purpose: "comment"
          const result = await uploadFile(
            item.file,
            (progress: number) => {
              setUploadingImages((prev) =>
                prev.map((img) =>
                  img.id === item.id ? { ...img, progress } : img
                )
              );
            },
            "comment"
          );

          // 上传成功，添加到图片列表（使用后端返回的尺寸）
          const newImage: CommentPicture = {
            url: result.url,
            width: result.width || 0,
            height: result.height || 0,
            size: item.file.size / 1024, // 转换为 KB
          };

          onChange([...images, newImage]);

          // 移除上传中的项
          setUploadingImages((prev) =>
            prev.filter((img) => img.id !== item.id)
          );
          URL.revokeObjectURL(item.preview);
        } catch (error) {
          // 上传失败
          setUploadingImages((prev) =>
            prev.map((img) =>
              img.id === item.id
                ? {
                    ...img,
                    status: "error" as const,
                    error: error instanceof Error ? error.message : "上传失败",
                  }
                : img
            )
          );
        }
      }

      // 清空 input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [images, uploadingImages, maxCount, onChange]
  );

  /**
   * 删除已上传的图片
   */
  const handleRemoveImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages);
    },
    [images, onChange]
  );

  /**
   * 删除上传中的图片
   */
  const handleRemoveUploading = useCallback((id: string) => {
    setUploadingImages((prev) => {
      const item = prev.find((img) => img.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  /**
   * 点击上传按钮
   */
  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const canUploadMore =
    images.length + uploadingImages.length < maxCount && !disabled;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 已上传的图片 */}
      {images.map((image, index) => (
        <div
          key={index}
          className="relative w-20 h-20 rounded border border-border overflow-hidden group"
        >
          <img
            src={getUploadUrl(image.url)}
            alt=""
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemoveImage(index)}
              className={cn(
                "absolute top-1 right-1 p-1 rounded-full",
                "bg-black/60 text-white",
                "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* 上传中的图片 */}
      {uploadingImages.map((item) => (
        <div
          key={item.id}
          className="relative w-20 h-20 rounded border border-border overflow-hidden"
        >
          <img
            src={item.preview}
            alt=""
            className="w-full h-full object-cover"
          />
          {item.status === "uploading" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
          {item.status === "error" && (
            <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleRemoveUploading(item.id)}
                className="text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 上传按钮 */}
      {canUploadMore && (
        <button
          type="button"
          onClick={handleClickUpload}
          disabled={disabled}
          className={cn(
            "w-20 h-20 rounded border-2 border-dashed border-border",
            "flex flex-col items-center justify-center gap-1",
            "hover:border-primary hover:bg-muted/50 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {images.length + uploadingImages.length}/{maxCount}
          </span>
        </button>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
