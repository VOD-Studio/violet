import type { UserDTO } from "@entities/user/model/types";
import { useUpdateProfile } from "@features/auth/api/mutations";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Button, UploadTile } from "@violet/ui";
import { ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "./SectionCard";

/** 主页封面独立保存；移除时恢复头像背景，不删除上传素材。 */
export function ProfileCoverSection({ user }: { user: UserDTO }) {
	const updateProfile = useUpdateProfile();
	const [file, setFile] = useState<File | undefined>();
	const [open, setOpen] = useState(false);
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
		<SectionCard title="主页封面">
			{user.cover_url ? (
				<div className="relative h-40 overflow-hidden rounded-xl bg-muted sm:h-48">
					<CroppedImage
						src={user.cover_url}
						fillContainer
						className="absolute inset-0"
						alt="当前主页封面"
					/>
					<div className="absolute right-2 bottom-2 flex gap-1">
						<Button
							variant="secondary"
							size="icon-sm"
							aria-label="更换封面"
							title="更换封面"
							disabled={updateProfile.isPending}
							onClick={selectCover}
						>
							<ImagePlus className="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon-sm"
							aria-label="移除封面"
							title="移除封面"
							disabled={updateProfile.isPending}
							onClick={removeCover}
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
				</div>
			) : (
				<UploadTile
					aria-label="上传封面"
					title="上传封面"
					busy={updateProfile.isPending}
					onClick={selectCover}
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						selectFiles(event.dataTransfer.files);
					}}
					className="aspect-auto h-40 rounded-xl sm:h-48"
				/>
			)}
			<input {...inputProps} className="hidden" aria-label="选择主页封面" />
			<CropUploadDialog
				key={file ? `${file.name}:${file.lastModified}` : "empty"}
				file={file}
				purpose="cover"
				fileNameBase="profile-cover"
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
