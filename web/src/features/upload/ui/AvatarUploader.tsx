import { useState } from "react";
import type { UserDTO } from "@/entities/user/model/types";
import { useUpdateProfile } from "@/features/auth/api/mutations";
import { completeUpload, initUpload, uploadChunk } from "../api/mutations";
import { avatarUrl } from "../lib/imageUrl";
import { sha256 } from "../lib/sha256";

interface AvatarUploaderProps {
	user: UserDTO;
}

/**
 * AvatarUploader - 头像上传组件
 *
 * 流程：选图 → 算 SHA-256 → initUpload 秒传检查，
 * 命中则直接用返回 url，未命中则单分片上传后 completeUpload，最后更新个人资料。
 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const updateProfile = useUpdateProfile();

	const handleFile = async (file: File) => {
		setBusy(true);
		setError("");
		try {
			const hash = await sha256(file);
			const init = await initUpload({
				fileName: file.name,
				fileSize: file.size,
				fileHash: hash,
				mimeType: file.type,
				chunkSize: file.size,
				purpose: "avatar",
			});

			let url = init.url;
			// 秒传未命中则上传单分片
			if (!init.instant && init.upload_id) {
				const buf = await file.arrayBuffer();
				await uploadChunk(init.upload_id, 0, buf);
				const merged = await completeUpload(init.upload_id);
				url = merged.url;
			}
			if (!url) throw new Error("上传失败：未返回 URL");

			// 更新个人资料头像
			await updateProfile.mutateAsync({ avatar_url: url });
		} catch (e) {
			setError(e instanceof Error ? e.message : "上传失败");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col items-center gap-2">
			<img
				src={avatarUrl(user.avatar_url)}
				alt={`${user.username} 的头像`}
				className="h-24 w-24 rounded-full object-cover"
			/>
			<label className="cursor-pointer text-sm text-blue-600 hover:underline">
				{busy ? "上传中..." : "更换头像"}
				<input
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp"
					className="hidden"
					disabled={busy}
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) handleFile(f);
						e.target.value = ""; // 允许重复选同一文件
					}}
				/>
			</label>
			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}
