import type { Tag } from "@entities/tag/model/types";
import { type TagForm, tagSchema } from "@features/admin-tags/model/schema";
import { useCreateTag, useUpdateTag } from "@features/tags/api/mutations";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface TagDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editing?: Tag | null;
}

export function TagDialog({ open, onOpenChange, editing }: TagDialogProps) {
	const isEdit = !!editing;
	const createTag = useCreateTag();
	const updateTag = useUpdateTag();
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<TagForm>({
		resolver: zodResolver(tagSchema),
		defaultValues: { name: "" },
	});

	useEffect(() => {
		if (open) {
			reset({ name: editing?.name || "" });
		}
	}, [open, editing, reset]);

	const onSubmit = (data: TagForm) => {
		if (isEdit && editing?.id) {
			updateTag.mutate(
				{ id: editing.id, body: { name: data.name } },
				{ onSuccess: () => onOpenChange(false) },
			);
		} else {
			createTag.mutate({ name: data.name }, { onSuccess: () => onOpenChange(false) });
		}
	};

	const pending = createTag.isPending || updateTag.isPending;

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={isEdit ? "编辑标签" : "创建标签"}
			description={isEdit ? "修改标签名称（slug 将自动重算）" : "新建一个标签"}
			size="sm"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						取消
					</Button>
					<Button type="submit" form="tag-form" disabled={pending}>
						{pending && <Loader2 className="mr-1 size-4 animate-spin" />}
						{isEdit ? "保存" : "创建"}
					</Button>
				</>
			}
		>
			<form id="tag-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="tag-name">
						标签名 <span className="text-destructive">*</span>
					</Label>
					<Input id="tag-name" disabled={pending} {...register("name")} />
					{errors.name && (
						<p className="text-destructive text-sm">{errors.name.message}</p>
					)}
				</div>
			</form>
		</Modal>
	);
}
