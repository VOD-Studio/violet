/// <reference types="remark-parse" />

/**
 * 聊天消息 Markdown 渲染管线的自定义 remark/rehype 插件。
 *
 * remarkChatInline 只挂载 GFM 的删除线 + 自动链接两个子扩展，不引入 remark-gfm
 * 整包（表格/任务列表/脚注/HTML 标签过滤）——聊天气泡宽度不适合渲染表格/任务
 * 列表，产品决策已明确排除；不挂载对应扩展即可让这两种语法保持字面文本，
 * 无需再在渲染层做额外的组件覆盖去抑制它们。
 *
 * rehypeChatEmoji 在 markdown 渲染出的 hast 树上做表情替换：[name] 占位符可能
 * 嵌在粗体/斜体标记内部，必须在解析后的树上按文本节点处理，不能像
 * EmojiText 那样对原始字符串做正则替换（会被 Markdown 解析打断）。
 */
import type { CommentEmoteRef } from "@entities/comment/model/types";
import { isImageURL } from "@shared/lib/url";
import type { Element, ElementContent, Root as HastRoot, Text as HastText } from "hast";
import type { Root as MdastRoot } from "mdast";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import type { Processor } from "unified";
import { visit } from "unist-util-visit";

export function remarkChatInline(this: unknown): void {
	const self = this as Processor<MdastRoot>;
	const data = self.data();
	data.micromarkExtensions ??= [];
	data.fromMarkdownExtensions ??= [];
	const micromarkExtensions = data.micromarkExtensions;
	const fromMarkdownExtensions = data.fromMarkdownExtensions;
	micromarkExtensions.push(gfmStrikethrough(), gfmAutolinkLiteral());
	fromMarkdownExtensions.push(gfmStrikethroughFromMarkdown(), gfmAutolinkLiteralFromMarkdown());
}

const EMOJI_TOKEN = /\[([^\]]+)\]/g;

/** 表情占位符替换插件工厂：未命中 emote 表或非图片 URL 的占位符原样保留为文本。 */
export function rehypeChatEmoji(emote: Record<string, CommentEmoteRef> | undefined) {
	return () => (tree: HastRoot) => {
		if (!emote) return;
		visit(tree, "text", (node, index, parent) => {
			if (index === undefined || !parent) return;
			const replacement = splitEmojiText(node.value, emote);
			if (replacement) parent.children.splice(index, 1, ...replacement);
		});
	};
}

function splitEmojiText(
	text: string,
	emote: Record<string, CommentEmoteRef>,
): ElementContent[] | null {
	EMOJI_TOKEN.lastIndex = 0;
	let lastIndex = 0;
	let matched = false;
	const nodes: ElementContent[] = [];
	for (let match = EMOJI_TOKEN.exec(text); match; match = EMOJI_TOKEN.exec(text)) {
		const [fullMatch] = match;
		const ref = emote[fullMatch];
		if (!ref) continue;
		matched = true;
		if (match.index > lastIndex) nodes.push(textNode(text.slice(lastIndex, match.index)));
		const src = ref.gif_url || ref.url;
		nodes.push(
			src && isImageURL(src)
				? emojiImageNode(fullMatch, src, ref.size)
				: textNode(src || fullMatch),
		);
		lastIndex = match.index + fullMatch.length;
	}
	if (!matched) return null;
	if (lastIndex < text.length) nodes.push(textNode(text.slice(lastIndex)));
	return nodes;
}

function textNode(value: string): HastText {
	return { type: "text", value };
}

function emojiImageNode(alt: string, src: string, size: number | undefined): Element {
	return {
		type: "element",
		tagName: "img",
		properties: {
			src,
			alt,
			// 与 Markdown 图片语法 ![]() 的 img 区分：那类降级为链接不加载，见 img 组件覆盖
			"data-emoji": "true",
			className: ["inline-block", "align-text-bottom", size === 2 ? "size-10" : "size-5"],
			loading: "lazy",
		},
		children: [],
	};
}
