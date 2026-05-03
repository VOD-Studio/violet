import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useAuth";
import { uploadFile } from "@/components/upload/ChunkedUpload";
import { getUploadUrl } from "@/lib/api";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";

export default function AvatarUpload() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [uploading, setUploading] = useState(false);
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
    try {
      const result = await uploadFile(file, () => {}, "avatar");
      await updateProfile.mutateAsync({
        username: user!.username,
        bio: user?.bio ?? "",
        avatar_url: result.url,
      });
      toast.success("头像更新成功");
    } catch {
      toast.error("头像上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative size-24 overflow-hidden rounded-full border-2 border-muted bg-muted transition-colors hover:border-primary"
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-white" />
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
      <p className="text-xs text-muted-foreground">点击头像更换</p>
    </div>
  );
}
