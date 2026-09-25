import { useShikiHighlight } from "@shared/ui/code-preview/use-shiki-highlight";
import "./component-code.css";

/**
 * LightCodeBlock - 浅色主题代码块（github-light 高亮 + CSS 行号）
 *
 * 组件文档页专用：与页面底色自然衔接，避免深色代码块在文档页的割裂感。
 * 依赖 component-code.css 提供的 .shiki-line-numbers 行号计数样式。
 */
export function LightCodeBlock({ code }: { code: string }) {
	const { html, loading } = useShikiHighlight(code, "tsx", { theme: "light" });

	return (
		<div className="font-mono text-sm leading-relaxed">
			{loading ? (
				<div className="flex h-24 items-center justify-center">
					<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
				</div>
			) : html ? (
				<div
					className="shiki-line-numbers overflow-x-auto px-1 py-3 [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0! [&_code]:font-mono! [&_code]:text-sm!"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki codeToHtml 对代码文本做 HTML 实体转义，输出属性仅 class/style 受控集合，无注入面
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			) : (
				<pre className="shiki-line-numbers overflow-x-auto px-1 py-3 text-sm text-foreground">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}
