/**
 * CodeCard - 静态代码展示卡（shiki 高亮 + 标题栏 + 复制按钮）
 *
 * 接受内联代码字符串渲染只读代码块，跨 feature 复用（文章正文 / 图块降级 /
 * MCP 接入示例 / SDK 文档）。外边距由调用方通过 className 控制。
 *
 * @remarks 走懒加载消费时与 shiki 高亮链同 chunk 拉取，不进宿主主包。
 */
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/utils";
import { useShikiHighlight } from "../use-shiki-highlight";

export interface CodeCardProps {
	/** 原始代码字符串 */
	code: string;
	/** shiki 语言 ID（如 typescript / go / bash），未知传 "text" */
	language: string;
	/** 标题栏文案，默认显示 language */
	title?: string;
	/** 根容器类名（控制外边距等布局属性） */
	className?: string;
}

export function CodeCard({ code, language, title, className }: CodeCardProps) {
	const { html, loading } = useShikiHighlight(code, language);
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		const ok = await copyText(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} else {
			console.error("复制代码失败");
		}
	};

	return (
		<div
			className={cn(
				"group relative overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]",
				className,
			)}
		>
			{/* 顶部：标题 + 复制按钮 */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="font-mono text-xs text-white/70">
					{(title ?? language) || "text"}
				</span>
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
					title="复制代码"
				>
					{copied ? (
						<Check className="size-3.5 text-green-400" />
					) : (
						<Copy className="size-3.5 text-white/60" />
					)}
					{copied ? "已复制" : "复制"}
				</button>
			</div>
			{/* 代码区：shiki 输出 <pre><code>，直接渲染 */}
			{loading ? (
				<div className="flex h-24 items-center justify-center">
					<div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
				</div>
			) : html ? (
				<div
					className="shiki-code code-block-scrollbar overflow-x-auto px-4 py-3 text-sm leading-relaxed [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0! [&_code]:font-mono! [&_code]:text-sm!"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki codeToHtml 对代码文本做 HTML 实体转义（<script> 渲染为 &#x3C;script&#x3E; 纯文本，实测无裸标签），输出属性仅 class/style/tabindex 受控集合，无 href/src/on*；代码块内容不可能注入可执行 HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			) : (
				// 高亮失败降级：纯文本
				<pre className="code-block-scrollbar overflow-x-auto px-4 py-3 text-sm leading-relaxed text-white/90">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}
