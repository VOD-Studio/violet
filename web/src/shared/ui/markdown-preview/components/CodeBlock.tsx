/**
 * FencedCodeBlock - 围栏代码块（shiki 高亮 + 语言标签 + 复制）
 *
 * 供 markdown-components 懒加载：只有文章正文出现围栏代码块时，才拉取本模块
 * 及其依赖（useShikiHighlight → shiki core 单例），不进入文章正文主 chunk。
 *
 * 行内代码由 markdown-components 内联处理（纯样式，无高亮），不走本组件。
 */
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText } from "@/shared/lib/clipboard";
import { useShikiHighlight } from "@/shared/ui/code-preview/use-shiki-highlight";

/**
 * FencedCodeBlock - 围栏代码块：shiki 高亮 + 语言标签 + 复制按钮
 */
export function FencedCodeBlock({ code, language }: { code: string; language: string }) {
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
		<div className="group relative my-6 overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
			{/* 顶部：语言标签 + 复制按钮 */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="font-mono text-xs text-white/70">{language || "text"}</span>
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
