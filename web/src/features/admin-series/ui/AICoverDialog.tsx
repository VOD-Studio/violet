/**
 * AICoverDialog - AI 生成书籍封面弹窗
 *
 * 输入提示词（默认由书名+简介预填，可改）与张数，调生图端点；
 * 候选以竖版书封比例网格呈现，点选即回填封面 URL。生成结果已落
 * 素材库（purpose=material），选定后仍走保存写入封面字段。
 */
import { useGenerateCovers } from "@features/admin-series/api/mutations";
import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/base/dialog";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import InlineError from "@shared/ui/inline-error";
import { WandSparkles } from "lucide-react";
import { useState } from "react";

interface AICoverDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 书 id（生图端点路径参数） */
	seriesId: string;
	/** 默认提示词素材：书名 */
	title: string;
	/** 默认提示词素材：简介 */
	description: string;
	/** 点选候选后的回填回调 */
	onSelect: (url: string) => void;
}

const MAX_COUNT = 4;

export function AICoverDialog({
	open,
	onOpenChange,
	seriesId,
	title,
	description,
	onSelect,
}: AICoverDialogProps) {
	const [prompt, setPrompt] = useState("");
	const [count, setCount] = useState(2);
	const [urls, setUrls] = useState<string[]>([]);
	const generate = useGenerateCovers(seriesId);

	const defaultPrompt = `为技术书籍《${title}》设计一张简洁的竖版封面${
		description ? `，主题：${description}` : ""
	}。要求抽象几何、低饱和、无文字。`;
	const effectivePrompt = prompt.trim() || defaultPrompt;

	const handleGenerate = () => {
		generate.mutate(
			{ prompt: effectivePrompt, count },
			{
				onSuccess: (res) => setUrls(res.urls ?? []),
			},
		);
	};

	const handlePick = (url: string) => {
		onSelect(url);
		setUrls([]);
		setPrompt("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>AI 生成封面</DialogTitle>
					<DialogDescription>
						候选会存入素材库；点选一张后回填到封面字段，点「保存」才生效。
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="ai-cover-prompt">画面描述</Label>
						<Input
							id="ai-cover-prompt"
							value={prompt}
							placeholder={defaultPrompt}
							onChange={(e) => setPrompt(e.target.value)}
							disabled={generate.isPending}
						/>
						<p className="text-muted-foreground text-xs">
							留空时按上面的默认文案生成。
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ai-cover-count">张数</Label>
						<div className="flex gap-2">
							{[2, 3, MAX_COUNT].map((n) => (
								<Button
									key={n}
									type="button"
									size="sm"
									variant={count === n ? "default" : "outline"}
									disabled={generate.isPending}
									onClick={() => setCount(n)}
								>
									{n} 张
								</Button>
							))}
						</div>
					</div>

					{generate.isPending ? (
						<div className="grid grid-cols-2 gap-3">
							{Array.from({ length: count }, (_, i) => (
								<div
									key={i}
									className="aspect-2/3 animate-pulse rounded-lg bg-muted"
								/>
							))}
						</div>
					) : null}

					{generate.isError && generate.error ? (
						<InlineError
							message={generate.error.message}
							onRetry={() => generate.mutate({ prompt: effectivePrompt, count })}
							retrying={generate.isPending}
						/>
					) : null}

					{!generate.isPending && urls.length > 0 ? (
						<div className="grid grid-cols-2 gap-3">
							{urls.map((url) => (
								<button
									key={url}
									type="button"
									onClick={() => handlePick(url)}
									className="group overflow-hidden rounded-lg border border-edge-hairline transition-colors hover:border-primary"
								>
									<img
										src={url}
										alt="AI 封面候选"
										className="aspect-2/3 w-full object-cover transition-transform group-hover:scale-[1.02]"
									/>
								</button>
							))}
						</div>
					) : null}
				</div>
				<DialogFooter>
					<Button type="button" onClick={handleGenerate} disabled={generate.isPending}>
						<WandSparkles className="size-4" />
						{generate.isPending ? "生成中…" : urls.length > 0 ? "重新生成" : "生成"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
