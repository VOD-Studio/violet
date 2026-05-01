// 封面图上传组件
// 支持本地上传和从素材库选择

import { useState } from "react";
import { Camera, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUploadUrl } from "@/lib/api";
import {
  uploadFile,
  type UploadResult,
} from "@/components/upload/ChunkedUpload";

interface CoverImageUploadProps {
  /** 当前封面图 URL */
  value: string;
  /** 封面图变化回调 */
  onChange: (url: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 打开素材库选择器 */
  onOpenMediaPicker?: () => void;
}

/**
 * 封面图上传组件
 */
export function CoverImageUpload({
  value,
  onChange,
  disabled,
  onOpenMediaPicker,
}: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result: UploadResult = await uploadFile(file);
      onChange(result.url);
    } catch (err) {
      console.error("封面图上传失败:", err);
    } finally {
      setUploading(false);
    }
  }

  function clearCover() {
    onChange("");
  }

  if (value) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg">
        <img
          src={getUploadUrl(value)}
          alt="封面图"
          className="h-full w-full object-cover"
        />
        <Button
          variant="destructive"
          size="icon-sm"
          className="absolute right-2 top-2"
          onClick={clearCover}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={disabled || uploading}
        />
        <div className="text-center">
          {uploading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          ) : (
            <Camera className="mx-auto h-8 w-8" />
          )}
          <p className="mt-1 text-sm">
            {uploading ? "上传中..." : "点击上传封面图"}
          </p>
        </div>
      </label>
      {onOpenMediaPicker && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onOpenMediaPicker}
          disabled={disabled || uploading}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          从素材库选择
        </Button>
      )}
    </div>
  );
}
