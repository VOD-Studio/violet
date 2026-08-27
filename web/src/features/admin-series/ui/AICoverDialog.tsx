/**
 * AICoverDialog - AI 生成书籍封面弹窗
 *
 * 两种形态共用一套交互：编辑态传 seriesId（走书的生图端点，prompt 默认由
 * 书名+简介构造）；创建态不传（standalone 端点，书未落库，prompt 由表单
 * 当前输入构造）。候选已落素材库（purpose=material），点选回填封面 URL；
 * 创建态选定后随 create_series 一起提交。
 *
 * 长耗时体验：生成中可关弹窗继续填表单——mutation 挂在弹窗外的调用方，
 * 结果存组件 state，重开弹窗仍在（本步同步形态；异步任务化见 issue）。
 */
import {
	useGenerateCovers,
	useGenerateCoversStandalone,
} from "@features/admin-series/api/mutations";
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
	/** 书 id；不传 = 创建态（standalone 生图，书未落库） */
	seriesId?: string;
	/** 默认提示词素材：书名（创建态为表单当前输入） */
	title: string;
	/** 默认提示词素材：简介（创建态为表单当前输入） */
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
	const bound = useGenerateCovers(seriesId ?? "");
	const standalone = useGenerateCoversStandalone();
	const generate = seriesId ? bound : standalone;

	const defaultPrompt = `为技术书籍《${title}》设计一张简洁的竖版封面${
		description ? `，主题：${description}` : ""
	}。要求抽象几何、低饱和、无文字。`;
	const effectivePrompt = prompt.trim() || defaultPrompt;

	const handleGenerate = () => {
		const input = { prompt: effectivePrompt, count };
		if (seriesId) {
			bound.mutate(input, { onSuccess: (res) => setUrls(res.urls ?? []) });
		} else {
			standalone.mutate(input, { onSuccess: (res) => setUrls(res.urls ?? []) });
		}
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
						{seriesId
							? "候选会存入素材库；点选一张后回填到封面字段，点「保存」才生效。"
							: "候选会存入素材库；点选一张先回填表单，随「创建」一起提交。"}
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
							onRetry={() => handleGenerate()}
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
