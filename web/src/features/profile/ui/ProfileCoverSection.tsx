import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import {
	COVER_ASPECT,
	COVER_FRAME_CLASS,
	COVER_MIN_SHARE,
	COVER_MIN_WIDTH,
	COVER_OUTPUT_WIDTH,
	COVER_PREVIEWS,
} from "@shared/lib/profile-cover";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Button } from "@violet/ui";
import { cn } from "cn";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "./SectionCard";

/** 主页封面独立保存；移除时恢复头像背景，不删除上传素材。 */
export function ProfileCoverSection({ user }: { user: UserDTO }) {
	const updateProfile = useUpdateProfile();
	const [file, setFile] = useState<File | undefined>();
	const [open, setOpen] = useState(false);
	const [dragging, setDragging] = useState(false);
	const {
		inputProps,
		open: selectCover,
		selectFiles,
	} = useFileSelection({
		accept: "image/jpeg,image/png,image/gif,image/webp",
		maxSize: 10 * 1024 * 1024,
		maxFiles: 1,
		disabled: updateProfile.isPending || open,
		onSelect: (files) => {
			setFile(files[0]);
			setOpen(true);
		},
	});

	const saveCover = async (result: CropUploadResult) => {
		await updateProfile.mutateAsync({ cover_url: result.url });
		setFile(undefined);
		toast.success("主页封面已更新");
	};

	const removeCover = async () => {
		try {
			await updateProfile.mutateAsync({ cover_url: "" });
			toast.success("已移除封面，恢复头像背景");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "移除封面失败");
		}
	};

	return (
		<SectionCard
			title="主页封面"
			description="显示在公开主页顶部；未设置时用头像生成背景。推荐 1500×500 以上。"
		>
			{user.cover_url ? (
				<div
					className={cn(
						"relative overflow-hidden rounded-xl bg-muted ring-1 ring-border ring-inset",
						COVER_FRAME_CLASS,
					)}
				>
					<CroppedImage
						src={user.cover_url}
						fillContainer
						className="absolute inset-0"
						alt="当前主页封面"
					/>
					<div className="absolute right-3 bottom-3 flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={updateProfile.isPending}
							onClick={selectCover}
						>
							<ImagePlus className="size-4" />
							更换
						</Button>
						<Button
							variant="secondary"
							size="sm"
							disabled={updateProfile.isPending}
							onClick={removeCover}
						>
							<Trash2 className="size-4" />
							移除
						</Button>
					</div>
				</div>
			) : (
				<button
					type="button"
					aria-label="上传封面"
					disabled={updateProfile.isPending}
					onClick={selectCover}
					onDragOver={(event) => {
						event.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(event) => {
						event.preventDefault();
						setDragging(false);
						selectFiles(event.dataTransfer.files);
					}}
					className={cn(
						"flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-muted-foreground transition-colors",
						"hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
						dragging
							? "border-primary bg-primary/10 text-foreground"
							: "border-border bg-muted/40",
						COVER_FRAME_CLASS,
					)}
				>
					{updateProfile.isPending ? (
						<Loader2 className="size-6 animate-spin" />
					) : (
						<ImagePlus className="size-6" />
					)}
					<span className="text-sm font-medium">点击或拖入图片</span>
					<span className="text-xs">JPG / PNG / WebP / GIF，不超过 10 MB</span>
				</button>
			)}
			<input {...inputProps} className="hidden" aria-label="选择主页封面" />
			<CropUploadDialog
				key={file ? `${file.name}:${file.lastModified}` : "empty"}
				file={file}
				aspect={COVER_ASPECT}
				purpose="cover"
				fileNameBase="profile-cover"
				title="调整主页封面"
				description="拖动图片取景，窄屏会裁掉左右两侧，重要内容放在中间。"
				confirmLabel="使用此封面"
				previews={COVER_PREVIEWS}
				outputMaxWidth={COVER_OUTPUT_WIDTH}
				minSelectionWidth={COVER_MIN_WIDTH}
				minSelectionShare={COVER_MIN_SHARE}
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) setFile(undefined);
				}}
				onConfirm={saveCover}
			/>
		</SectionCard>
	);
}
