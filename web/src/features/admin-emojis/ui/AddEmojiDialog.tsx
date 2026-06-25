import { useCreateEmoji, useUploadEmoji } from "@features/emojis/api/mutations";
import type { EmojiUploadResult } from "@features/emojis/model/types";
import { Button } from "@shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface AddEmojiDialogProps {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	groupId: number;
	onAdded: () => void;
}

// 后端 MIME 嗅探实际接受的类型（SVG 会被拒，故不在 accept 里）
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * AddEmojiDialog - 添加表情弹窗（两步）
 *
 * 1. 选择图片 → useUploadEmoji 上传，返回 url（不落库）。
 * 2. 填 name → useCreateEmoji 落库（带上传返回的 url）。
 * 也支持纯文字表情（跳过上传，只填 name + text_content）。
 */
export function AddEmojiDialog({ open, onOpenChange, groupId, onAdded }: AddEmojiDialogProps) {
	const [name, setName] = useState("");
	const [textContent, setTextContent] = useState("");
	const [uploaded, setUploaded] = useState<EmojiUploadResult | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const uploadEmoji = useUploadEmoji();
	const createEmoji = useCreateEmoji(groupId);

	const reset = () => {
		setName("");
		setTextContent("");
		setUploaded(null);
		setPreviewUrl(null);
		if (fileRef.current) fileRef.current.value = "";
	};

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		// 本地预览
		setPreviewUrl(URL.createObjectURL(file));
		uploadEmoji.mutate(file, {
			onSuccess: (result) => {
				setUploaded(result);
				// 上传成功后用文件名（去扩展名）预填 name
				if (!name) {
					setName(result.filename.replace(/\.[^.]+$/, ""));
				}
			},
			onError: (err) => {
				toast.error(err.message);
				setPreviewUrl(null);
				if (fileRef.current) fileRef.current.value = "";
			},
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!uploaded && !textContent) {
			toast.error("请上传图片或填写文字内容");
			return;
		}
		createEmoji.mutate(
			{
				name,
				url: uploaded?.url,
				text_content: textContent || undefined,
			},
			{
				onSuccess: () => {
					toast.success("表情已添加");
					reset();
					onOpenChange(false);
					onAdded();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleClose = (v: boolean) => {
		if (!v) reset();
		onOpenChange(v);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>添加表情</DialogTitle>
						<DialogDescription>上传图片或填写纯文字内容。</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{/* 图片上传区 */}
						<div className="space-y-1">
							<Label>图片</Label>
							<div className="flex items-center gap-3">
								<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
									{previewUrl ? (
										<img
											src={previewUrl}
											alt="预览"
											className="max-h-full max-w-full object-contain"
										/>
									) : (
										<Upload className="size-4 text-muted-foreground" />
									)}
								</div>
								<div className="flex flex-col gap-1">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={uploadEmoji.isPending}
										onClick={() => fileRef.current?.click()}
									>
										{uploadEmoji.isPending ? (
											<Loader2 className="size-3.5 animate-spin" />
										) : (
											"选择图片"
										)}
									</Button>
									<span className="text-[10px] text-muted-foreground">
										支持 png/jpeg/gif/webp，最大 10MB
									</span>
								</div>
								<input
									ref={fileRef}
									type="file"
									accept={ACCEPT}
									className="hidden"
									onChange={handleFile}
								/>
							</div>
						</div>

						<div className="space-y-1">
							<Label>名称 *</Label>
							<Input value={name} onChange={(e) => setName(e.target.value)} required />
						</div>

						<div className="space-y-1">
							<Label>文字内容（可选，用于纯文字表情）</Label>
							<Input
								value={textContent}
								onChange={(e) => setTextContent(e.target.value)}
								placeholder="如 (╯°□°）╯"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => handleClose(false)}>
							取消
						</Button>
						<Button type="submit" disabled={createEmoji.isPending || (!uploaded && !textContent)}>
							{createEmoji.isPending ? <Loader2 className="size-4 animate-spin" /> : "添加"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
