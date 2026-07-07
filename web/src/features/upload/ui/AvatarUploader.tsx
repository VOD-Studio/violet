import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { useState } from "react";
import type { UserDTO } from "@/entities/user/model/types";
import { useUpdateProfile } from "@/features/auth/api/mutations";
import { avatarUrl } from "../lib/imageUrl";
import { CropUploadDialog, type CropUploadResult } from "./CropUploadDialog";

interface AvatarUploaderProps {
    user: UserDTO;
}

/**
 * AvatarUploader - 头像上传组件。
 *
 * 流程:选图 → 弹裁剪选区 → 确认后 canvas 重编码上传 → 更新个人资料。
 * 显示层用 CroppedImage(本切片静态显示;?crop= 视觉裁剪在 Issue-0017)。
 *
 * 本切片(Issue-0016)只支持静态图裁剪上传;GIF 由 CropUploadDialog 拦截提示。
 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [error, setError] = useState("");
    const updateProfile = useUpdateProfile();

    const handleConfirm = async (result: CropUploadResult) => {
        setError("");
        try {
            await updateProfile.mutateAsync({ avatar_url: result.url });
            setPendingFile(null); // 释放待上传文件引用
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新头像失败");
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <CroppedImage
                src={avatarUrl(user.avatar_url, user.username)}
                aspect={1}
                className="h-24 w-24 rounded-full"
                alt={`${user.username} 的头像`}
            />
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                {updateProfile.isPending ? "保存中..." : "更换头像"}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={updateProfile.isPending}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            setPendingFile(f);
                            setCropOpen(true);
                        }
                        e.target.value = ""; // 允许重复选同一文件
                    }}
                />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <CropUploadDialog
                file={pendingFile ?? undefined}
                aspect={1}
                purpose="avatar"
                fileNameBase="avatar"
                open={cropOpen}
                onOpenChange={setCropOpen}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
