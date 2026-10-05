import { Button, Checkbox, Input, Modal } from "@violet/ui";
import { Globe } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { urlErrorMessage, validateUrl } from "@/shared/lib/url";
import type { ImportUrlOpts } from "../types";

interface ImportUrlButtonProps {
	onConfirm: (url: string, options: ImportUrlOpts) => void;
}

export function ImportUrlButton({ onConfirm }: ImportUrlButtonProps) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("https://");
	const [error, setError] = useState<string | null>(null);
	const [aiRestoreFormula, setAiRestoreFormula] = useState(false);
	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const trimmed = url.trim();
		const reason = validateUrl(trimmed);
		if (reason) {
			setError(urlErrorMessage(reason));
			return;
		}
		setError(null);
		setOpen(false);
		onConfirm(trimmed, { aiRestoreFormula });
	};
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="xs"
				title="导入远程链接文档"
				onClick={() => {
					setUrl("https://");
					setAiRestoreFormula(false);
					setError(null);
					setOpen(true);
				}}
			>
				<Globe /> 链接
			</Button>
			<Modal
				open={open}
				onOpenChange={setOpen}
				title="导入远程链接"
				description="粘贴网页地址，解析正文并替换当前内容"
				size="sm"
				footer={
					<>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							取消
						</Button>
						<Button type="submit" form={`${id}-form`}>
							导入
						</Button>
					</>
				}
			>
				<form id={`${id}-form`} onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<label htmlFor={`${id}-url`} className="text-sm font-medium">
							网页 URL
						</label>
						<Input
							id={`${id}-url`}
							value={url}
							onChange={(event) => {
								setUrl(event.target.value);
								setError(null);
							}}
							placeholder="https://example.com/article"
							autoFocus
						/>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</div>
					<label
						htmlFor={`${id}-formula`}
						className="flex cursor-pointer items-start gap-2 text-sm"
					>
						<Checkbox
							id={`${id}-formula`}
							checked={aiRestoreFormula}
							onCheckedChange={(checked) => setAiRestoreFormula(checked === true)}
							className="mt-0.5"
						/>
						<span>
							<span className="font-medium">用 AI 还原公式</span>
							<span className="block text-xs text-muted-foreground">
								对无法直接提取源码的公式（如 KaTeX 服务端渲染），调用 LLM 反推
								LaTeX。需管理员在站点设置配置 LLM。
							</span>
						</span>
					</label>
				</form>
			</Modal>
		</>
	);
}
