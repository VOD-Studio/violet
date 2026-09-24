import { copyText } from "@shared/lib/clipboard";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LightCodeBlock } from "./LightCodeBlock";

/**
 * ComponentDemo - 组件文档页折叠演示面板
 *
 * 一体化卡片：上方舞台内组件垂直水平居中，下方代码区以细线分隔、
 * 同底色浑然一体；折叠时以渐变遮罩截断，居中悬浮胶囊无缝展开。
 * 短代码（≤ 6 行）直接完整展示，不渲染遮罩与收起控件。
 */
export function ComponentDemo({ children, code }: { children: ReactNode; code: string }) {
	// 短代码（≤ 6 行）直接完整展示，不折叠、无遮罩
	const collapsible = code.split("\n").length > 6;
	const [showCode, setShowCode] = useState(!collapsible);
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyText(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="overflow-hidden rounded-xl border border-border/70 bg-card">
			{/* 舞台：组件垂直水平居中，大片留白 */}
			<div className="flex min-h-64 items-center justify-center p-6 sm:p-10">
				<div className="w-full max-w-2xl">{children}</div>
			</div>

			{/* 代码区：细线分隔，与舞台同底 */}
			<div className="relative border-t border-border/60">
				{/* 复制图标固定于代码区右上，纯图标形态 */}
				<button
					type="button"
					onClick={handleCopy}
					className="absolute top-3.5 right-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
					title="复制代码"
				>
					{copied ? (
						<Check className="size-4 text-green-500" />
					) : (
						<Copy className="size-4" />
					)}
					<span className="sr-only">复制代码</span>
				</button>

				{/* max-height 过渡提供平滑的展开收起动画 */}
				<div
					className={`relative overflow-hidden transition-[max-height] duration-300 ease-in-out ${
						!collapsible || showCode ? "max-h-[80rem]" : "max-h-52"
					}`}
				>
					<LightCodeBlock code={code} />

					{/* 折叠态：底部渐变遮罩 + 居中悬浮胶囊 */}
					{collapsible && !showCode && (
						<div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 animate-in fade-in items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-5 duration-200">
							<button
								type="button"
								onClick={() => setShowCode(true)}
								className="pointer-events-auto inline-flex items-center rounded-full bg-card px-4 py-1.5 text-sm text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-colors hover:bg-muted"
							>
								<span>Expand code</span>
							</button>
						</div>
					)}
				</div>

				{/* 展开态：与 Expand 胶囊同款的居中收起胶囊 */}
				{collapsible && showCode && (
					<div className="flex justify-center border-t border-border/50 py-3">
						<button
							type="button"
							onClick={() => setShowCode(false)}
							className="inline-flex items-center rounded-full bg-card px-4 py-1.5 text-sm text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-colors hover:bg-muted"
						>
							<span>Collapse code</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
