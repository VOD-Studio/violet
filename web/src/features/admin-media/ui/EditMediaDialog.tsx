import type { MediaFile } from "@entities/media/model/types";
import { useUpdateMediaMetadata } from "@features/admin-media/api/mutations";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import { Modal } from "@/shared/ui/modal";

interface EditMediaDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file: MediaFile | null;
}

interface EditFormData {
	original_name: string;
	alt_text: string;
	category: string;
}

/**
 * EditMediaDialog - 素材元数据编辑对话框
 *
 * 编辑文件名、描述（alt_text）、自定义分类。
 * 对接 PATCH /admin/media/{id}。
 */
export function EditMediaDialog({ open, onOpenChange, file }: EditMediaDialogProps) {
	const updateMutation = useUpdateMediaMetadata();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<EditFormData>();

	useEffect(() => {
		if (open && file) {
			reset({
				original_name: file.original_name,
				alt_text: file.alt_text ?? "",
				category: file.category ?? "",
			});
		}
	}, [open, file, reset]);

	const onSubmit = handleSubmit((data) => {
		if (!file) return;
		updateMutation.mutate(
			{
				id: file.id,
				data: {
					original_name: data.original_name,
					alt_text: data.alt_text,
					category: data.category,
				},
			},
			{
				onSuccess: () => {
					toast.success("已更新");
					onOpenChange(false);
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message
							: err.message || "更新失败，请稍后重试";
					toast.error(msg);
				},
			},
		);
	});

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="编辑素材"
			description="修改文件名、描述或分类"
			size="sm"
			footer={
				<>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button
						type="submit"
						form="edit-media-form"
						disabled={updateMutation.isPending}
					>
						{updateMutation.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								保存中…
							</>
						) : (
							"保存"
						)}
					</Button>
				</>
			}
		>
			<form id="edit-media-form" onSubmit={onSubmit} className="space-y-4">
				<div className="space-y-1">
					<Label htmlFor="original_name">文件名</Label>
					<Input
						id="original_name"
						{...register("original_name", { required: "请输入文件名" })}
					/>
					{errors.original_name ? (
						<p className="text-xs text-destructive">{errors.original_name.message}</p>
					) : null}
				</div>

				<div className="space-y-1">
					<Label htmlFor="alt_text">描述 / 替代文本</Label>
					<Input id="alt_text" placeholder="用于无障碍和 SEO" {...register("alt_text")} />
				</div>

				<div className="space-y-1">
					<Label htmlFor="category">分类</Label>
					<Input
						id="category"
						placeholder="自定义分类，如 banner、截图"
						{...register("category")}
					/>
				</div>
			</form>
		</Modal>
	);
}
