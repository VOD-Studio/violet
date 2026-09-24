import { copyText } from "@shared/lib/clipboard";
import { Check, ChevronDown, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LightCodeBlock } from "./LightCodeBlock";

/**
 * ComponentDemo - 组件文档页折叠演示面板
 *
 * 上方自然展示组件本体（children），下方代码卡片以渐变遮罩截断，
 * 点「展开代码」平滑展开完整浅色高亮代码；复制图标固定于卡片右上。
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
		<div>
			{/* 组件自然展示，无外壳 */}
			{children}

			{/* 代码区：细线分隔，浅色底与页面浑然一体 */}
			<div className="relative mt-6 overflow-hidden rounded-xl border border-border/70 bg-card">
				{/* 复制图标固定于卡片右上，实底浮层避免与代码文字混叠 */}
				<button
					type="button"
					onClick={handleCopy}
					className="absolute top-2.5 right-2.5 z-10 rounded-sm bg-background p-1 text-muted-foreground shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-colors hover:bg-muted hover:text-foreground"
					title="复制代码"
				>
					{copied ? (
						<Check className="size-3.5 text-green-500" />
					) : (
						<Copy className="size-3.5" />
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

					{/* 折叠态：底部渐变遮罩 + 内联展开控件 */}
					{collapsible && !showCode && (
						<div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 animate-in fade-in items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent duration-200">
							<button
								type="button"
								onClick={() => setShowCode(true)}
								className="pointer-events-auto mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								<span>展开代码</span>
								<ChevronDown className="size-3" />
							</button>
						</div>
					)}
				</div>

				{/* 展开态：与展开控件同款的居中收起控件 */}
				{collapsible && showCode && (
					<div className="flex justify-center border-t border-border/40 py-2.5">
						<button
							type="button"
							onClick={() => setShowCode(false)}
							className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							<span>收起代码</span>
							<ChevronDown className="size-3 rotate-180" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
