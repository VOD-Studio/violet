import type { Emoji } from "@entities/emoji/model/types";
import { type EmojiEditForm, emojiEditSchema } from "@features/admin-emojis/model/schema";
import type { UpdateEmojiRequest } from "@features/admin-emojis/model/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

interface EmojiEditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	emoji: Emoji | null;
	onSave: (body: UpdateEmojiRequest) => void;
	isSaving: boolean;
}

/**
 * EmojiEditDialog - 编辑表情弹窗
 *
 * 使用 React Hook Form + Zod 进行表单验证。
 * 图片表情编辑名称与图片链接，文本表情编辑名称与文本内容。
 */
export function EmojiEditDialog({
	open,
	onOpenChange,
	emoji,
	onSave,
	isSaving,
}: EmojiEditDialogProps) {
	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<EmojiEditForm>({
		resolver: zodResolver(emojiEditSchema),
		defaultValues: {
			name: "",
			url: "",
			textContent: "",
			metaAlias: "",
			metaSize: 0,
			metaType: 0,
		},
	});

	useEffect(() => {
		if (!open) return;
		if (emoji) {
			reset({
				name: emoji.name,
				url: emoji.url ?? "",
				textContent: emoji.text_content ?? "",
				metaAlias: emoji.meta?.alias ?? "",
				metaSize: emoji.meta?.size ?? 0,
				metaType: emoji.meta?.type ?? 0,
			});
		} else {
			reset({ name: "", url: "", textContent: "", metaAlias: "", metaSize: 0, metaType: 0 });
		}
	}, [open, emoji, reset]);

	const onSubmit = (data: EmojiEditForm) => {
		const alias = data.metaAlias?.trim();
		// meta 三字段全空时不传 meta（保持后端原值）；任一有值则整体下发
		const hasMeta = alias || data.metaSize || data.metaType;
		const body: UpdateEmojiRequest = {
			name: data.name.trim(),
			url: emoji?.url ? data.url?.trim() || undefined : undefined,
			text_content: !emoji?.url ? data.textContent?.trim() || undefined : undefined,
			meta: hasMeta
				? {
						alias: alias || undefined,
						size: data.metaSize || undefined,
						type: data.metaType || undefined,
					}
				: {},
		};
		onSave(body);
	};

	const isImage = !!emoji?.url;

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="编辑表情"
			description="修改表情的名称和内容"
			size="md"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						取消
					</Button>
					<Button type="submit" form="emoji-edit-form" disabled={isSaving}>
						{isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
						保存
					</Button>
				</>
			}
		>
			<form id="emoji-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{emoji && (
					<div className="flex justify-center">
						<div className="flex size-24 items-center justify-center rounded-lg border bg-muted/50">
							{isImage ? (
								<img
									src={emoji.url}
									alt={emoji.name}
									className="size-full rounded-lg object-contain"
								/>
							) : (
								<span className="text-3xl">{emoji.text_content ?? emoji.name}</span>
							)}
						</div>
					</div>
				)}

				<div className="space-y-2">
					<Label htmlFor="emoji-edit-name">
						名称 <span className="text-destructive">*</span>
					</Label>
					<Input
						id="emoji-edit-name"
						disabled={isSaving}
						aria-invalid={!!errors.name}
						{...register("name")}
					/>
					{errors.name && (
						<p className="text-sm text-destructive">{errors.name.message}</p>
					)}
				</div>

				{isImage ? (
					<div className="space-y-2">
						<Label htmlFor="emoji-edit-url">图片链接</Label>
						<Input
							id="emoji-edit-url"
							placeholder="URL"
							disabled={isSaving}
							{...register("url")}
						/>
					</div>
				) : (
					<div className="space-y-2">
						<Label htmlFor="emoji-edit-text">文本内容</Label>
						<Input
							id="emoji-edit-text"
							placeholder="文本内容"
							disabled={isSaving}
							{...register("textContent")}
						/>
					</div>
				)}

				<div className="space-y-3 rounded-md border p-3">
					<p className="text-sm font-medium">元数据</p>
					<p className="text-xs text-muted-foreground">
						源自 B站的别名/尺寸/门槛，留空则清空 meta。
					</p>

					<div className="space-y-2">
						<Label htmlFor="emoji-edit-alias">别名</Label>
						<Input
							id="emoji-edit-alias"
							placeholder="如：保佑"
							disabled={isSaving}
							{...register("metaAlias")}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label>尺寸</Label>
							<Controller
								control={control}
								name="metaSize"
								render={({ field }) => (
									<Select
										value={String(field.value)}
										onValueChange={(v) => field.onChange(Number(v))}
										disabled={isSaving}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="未设置" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="0">未设置</SelectItem>
											<SelectItem value="1">小（1）</SelectItem>
											<SelectItem value="2">大（2）</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						<div className="space-y-2">
							<Label>类型</Label>
							<Controller
								control={control}
								name="metaType"
								render={({ field }) => (
									<Select
										value={String(field.value)}
										onValueChange={(v) => field.onChange(Number(v))}
										disabled={isSaving}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="未设置" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="0">未设置</SelectItem>
											<SelectItem value="1">普通（1）</SelectItem>
											<SelectItem value="2">会员专属（2）</SelectItem>
											<SelectItem value="3">购买所得（3）</SelectItem>
											<SelectItem value="4">颜文字（4）</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
						</div>
					</div>
				</div>
			</form>
		</Modal>
	);
}
