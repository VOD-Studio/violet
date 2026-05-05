/**
 * 评论图片上传按钮和预览
 * 点击按钮弹出图片上传对话框，使用通用的 FileUploader 组件
 */

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import FileUploader from "@/components/upload/FileUploader";
import { getUploadUrl } from "@/lib/api";
import type { UploadResult } from "@/components/upload/ChunkedUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CommentImageButtonProps {
  /** 已上传的图片列表 */
  images: UploadedImage[];
  /** 图片变化回调 */
  onChange: (images: UploadedImage[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大图片数量 */
  maxCount?: number;
  /** 上传完成回调 */
  onUpload: (image: UploadedImage) => void;
}

interface CommentImagePreviewProps {
  /** 已上传的图片列表 */
  images: UploadedImage[];
  /** 删除图片回调 */
  onRemove: (localId: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface UploadedImage {
  /** 本地唯一 ID（用于 React key） */
  localId: string;
  /** 后端文件 ID（用于提交） */
  fileId: string;
  url: string;
  thumbnail: string;
}

/**
 * 评论图片上传按钮（仅按钮，用于工具栏）
 */
export function CommentImageButton({
  images,
  disabled = false,
  maxCount = 9,
  onUpload,
}: CommentImageButtonProps) {
  const [showUploader, setShowUploader] = useState(false);

  const handleUpload = (result: UploadResult) => {
    const uploadedImage: UploadedImage = {
      localId: nanoid(),
      fileId: result.id,
      url: result.url,
      thumbnail: result.thumbnail || result.url,
    };
    onUpload(uploadedImage);
  };

  const canUploadMore = images.length < maxCount && !disabled;

  return (
    <>
      {/* 工具栏按钮 */}
      <button
        type="button"
        onClick={() => setShowUploader(true)}
        disabled={!canUploadMore}
        className={cn(
          "p-2 rounded hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title="上传图片"
      >
        <ImageIcon className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* 上传对话框 */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>上传图片</DialogTitle>
          </DialogHeader>
          <FileUploader
            onUpload={handleUpload}
            accept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] }}
            maxSize={10 * 1024 * 1024}
            multiple={true}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 评论图片预览（用于输入框下方）
 */
export function CommentImagePreview({
  images,
  onRemove,
  disabled = false,
}: CommentImagePreviewProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {images.map((image) => (
        <div
          key={image.localId}
          className="relative w-20 h-20 rounded border border-border overflow-hidden group"
        >
          <img
            src={getUploadUrl(image.thumbnail)}
            alt=""
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(image.localId)}
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
    </div>
  );
}
