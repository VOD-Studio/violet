/**
 * ChatMessageContent - 聊天消息 Markdown 渲染
 *
 * 聊天气泡专用的轻量 Markdown 管线：行内格式（粗体/斜体/删除线/行内代码/链接）+
 * 块级基础（围栏代码块/引用块/列表），不含表格、任务列表、标题、公式、mermaid、
 * 可运行代码块——那套重管线是给博客文章用的（见 shared/ui/markdown-preview），
 * 塞进消息气泡（`max-w-[min(82%,36rem)]`）既不合适也没必要。
 *
 * 单换行走 remark-breaks 转成 <br>：保留旧版 whitespace-pre-wrap 的折行体验，
 * 否则 CommonMark 默认的段落合并规则会吃掉用户在 composer 里按 Shift+Enter
 * 换的每一行，且历史消息没法补空行来适配新规则。
 *
 * Markdown 图片语法 ![]() 降级为链接，不渲染 <img>：私聊场景下任意第三方图片
 * URL 会在打开消息时静默发起请求，泄露 IP/在线状态，这里没有图片代理能挡；
 * 真正的图片分享走既有的图片消息类型（上传 + 缩略图）。
 */
import type { CommentEmoteRef } from "@entities/comment/model/types";
import { cn } from "@shared/lib/utils";
import type { ReactElement, ReactNode } from "react";
import { lazy, Suspense, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import { rehypeChatEmoji, remarkChatInline } from "../lib/chat-markdown";

const LazyCodeCard = lazy(() =>
	import("@shared/ui/code-preview/components/CodeCard").then((m) => ({ default: m.CodeCard })),
);

const REMARK_PLUGINS = [remarkChatInline, remarkBreaks];

/** 把 react-markdown 传入的子节点递归拼成纯文本（围栏代码块取源码用） */
function nodeToText(node: ReactNode): string {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeToText).join("");
	if (typeof node === "object" && "props" in node) {
		const props = (node as ReactElement<{ children?: ReactNode }>).props;
		return nodeToText(props.children);
	}
	return "";
}

function HeadingFallback({ children }: { children?: ReactNode }) {
	return <strong className="font-semibold">{children}</strong>;
}

const chatMarkdownComponents: Components = {
	p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
	a: ({ children, href }) => (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="underline underline-offset-2 hover:opacity-80"
		>
			{children}
		</a>
	),
	strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
	em: ({ children }) => <em className="italic">{children}</em>,
	del: ({ children }) => <del className="line-through opacity-80">{children}</del>,
	blockquote: ({ children }) => (
		<blockquote className="my-1.5 border-l-2 border-current/30 pl-3 opacity-90">
			{children}
		</blockquote>
	),
	ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>,
	ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>,
	li: ({ children }) => <li>{children}</li>,
	hr: () => <hr className="my-2 border-current/20" />,
	// 标题：气泡宽度不适合渲染大字号标题，降级为加粗行内文本
	h1: HeadingFallback,
	h2: HeadingFallback,
	h3: HeadingFallback,
	h4: HeadingFallback,
	h5: HeadingFallback,
	h6: HeadingFallback,
	// Markdown 图片语法 ![]() 降级为链接，不加载：见文件头注释的隐私考虑。
	// 表情占位符替换出的 img（带 data-emoji 标记，见 chat-markdown.ts）不受影响，正常渲染。
	img: ({ src, alt, ...rest }) => {
		const props = rest as Record<string, unknown>;
		if (props["data-emoji"]) {
			const customEmojiID =
				typeof props["data-custom-emoji-id"] === "string"
					? props["data-custom-emoji-id"]
					: undefined;
			const relation =
				typeof props["data-relation"] === "string" ? props["data-relation"] : undefined;
			return (
				<img
					src={typeof src === "string" ? src : undefined}
					alt={alt ?? ""}
					data-custom-emoji-id={customEmojiID}
					data-relation={customEmojiID ? (relation ?? "none") : undefined}
					className={props.className as string | undefined}
					loading="lazy"
				/>
			);
		}
		return (
			<a
				href={typeof src === "string" ? src : undefined}
				target="_blank"
				rel="noopener noreferrer"
				className="underline underline-offset-2 hover:opacity-80"
			>
				{alt || src}
			</a>
		);
	},
	// 围栏块走 CodeCard（shiki 高亮 + 复制），懒加载；行内走纯样式。pre 透传给 code 分支。
	pre: ({ children }) => <>{children}</>,
	code: ({ className, children }) => {
		const cls = className || "";
		const code = nodeToText(children).replace(/\n$/, "");
		const match = /language-(\S+)/.exec(cls);
		const language = match?.[1] ?? "";
		const isFenced = !!match || code.includes("\n");
		if (!isFenced) {
			return (
				<code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
					{children}
				</code>
			);
		}
		return (
			<Suspense
				fallback={
					<pre className="code-block-scrollbar my-1.5 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-3 py-2 text-xs leading-relaxed text-white/90">
						<code>{code}</code>
					</pre>
				}
			>
				<LazyCodeCard code={code} language={language} className="my-1.5" />
			</Suspense>
		);
	},
};

export interface ChatMessageContentProps {
	/** 消息正文（Markdown 源文本） */
	content: string;
	/** 表情映射表，key 为 "[name]" */
	emote?: Record<string, CommentEmoteRef>;
	className?: string;
}

export function ChatMessageContent({ content, emote, className }: ChatMessageContentProps) {
	const rehypePlugins = useMemo(() => [rehypeChatEmoji(emote)], [emote]);
	return (
		<div className={cn(className)}>
			<ReactMarkdown
				remarkPlugins={REMARK_PLUGINS}
				rehypePlugins={rehypePlugins}
				components={chatMarkdownComponents}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
