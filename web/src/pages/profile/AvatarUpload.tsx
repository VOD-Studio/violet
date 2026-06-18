import { Camera, Check, User, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/components/upload/ChunkedUpload";
import { useAuth, useUpdateProfile } from "@/hooks/useAuth";
import { getUploadUrl } from "@/lib/api";

/** 圆形进度环组件 */
function CircularProgress({
  progress,
  size,
  strokeWidth,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-primary transition-all duration-200"
      />
    </svg>
  );
}

export default function AvatarUpload() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = user?.avatar_url ? getUploadUrl(user.avatar_url) : null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatus("idle");

    try {
      const result = await uploadFile(file, (p) => setProgress(p), "avatar");
      await updateProfile.mutateAsync({
        username: user?.username ?? "",
        bio: user?.bio ?? "",
        avatar_url: result.url,
      });
      setStatus("success");
      toast.success("头像更新成功");
    } catch {
      setStatus("error");
      toast.error("头像上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      // 成功或错误状态在 2 秒后自动重置为 idle
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const ringSize = 104;
  const strokeWidth = 3;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative size-24 overflow-hidden rounded-full border-2 border-muted bg-muted transition-colors hover:border-primary disabled:opacity-80"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.username}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <User className="size-10" />
          </div>
        )}

        {/* 上传进度环 */}
        {uploading && (
          <div
            className="absolute"
            style={{
              top: `calc(50% - ${ringSize / 2}px)`,
              left: `calc(50% - ${ringSize / 2}px)`,
            }}
          >
            <CircularProgress
              progress={progress}
              size={ringSize}
              strokeWidth={strokeWidth}
            />
          </div>
        )}

        {/* 悬停遮罩 + 状态图标 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {status === "success" ? (
            <Check className="size-6 text-green-400" />
          ) : status === "error" ? (
            <X className="size-6 text-red-400" />
          ) : uploading ? (
            <span className="text-sm font-medium text-white">{progress}%</span>
          ) : (
            <Camera className="size-6 text-white" />
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <p className="text-xs text-muted-foreground">
        {uploading
          ? `上传中 ${progress}%`
          : status === "success"
            ? "上传成功"
            : status === "error"
              ? "上传失败，请重试"
              : "点击头像更换"}
      </p>
    </div>
  );
}
