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
 *
 * rehypeChatMention 同理在 hast 上把 `@(username:id)` 占位符换成 data-mention 节点，
 * 渲染成什么由 ChatMessageContent 的 span 覆盖决定（提及要跳用户主页，插件里造不出路由链接）。
 */
import type { CommentEmoteRef } from "@entities/comment/model/types";
import { MENTION_ALL, mentionTokenPattern } from "@entities/user/model/mention-token";
import { isImageURL } from "@shared/lib/url";
import type { Element, ElementContent, Root as HastRoot, Text as HastText } from "hast";
import type { Root as MdastRoot } from "mdast";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import type { Processor } from "unified";
import { visit } from "unist-util-visit";
import type { ChatUser } from "../model/types";

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
				? emojiImageNode(fullMatch, src, ref)
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

function emojiImageNode(alt: string, src: string, ref: CommentEmoteRef): Element {
	return {
		type: "element",
		tagName: "img",
		properties: {
			src,
			alt,
			// 与 Markdown 图片语法 ![]() 的 img 区分：那类降级为链接不加载，见 img 组件覆盖
			"data-emoji": "true",
			...(ref.custom_emoji_id
				? {
						"data-custom-emoji-id": ref.custom_emoji_id,
						"data-relation": ref.relation ?? "none",
					}
				: {}),
			// 自定义表情没有 size 元数据，按贴纸语义渲染为大表情档
			className: [
				"inline-block",
				"align-text-bottom",
				ref.custom_emoji_id || ref.size === 2 ? "size-10" : "size-5",
			],
			loading: "lazy",
		},
		children: [],
	};
}

const INLINE_IMAGE_TOKEN = /!\[img:([^\]]+)\]/g;

/**
 * 内联图片占位符替换插件：`![img:id]` 转为带 data-image 的 img 节点（不含 src）。
 * 真实 URL 由渲染端组件按 id 解析自家上传媒体填充——第三方 URL 仍走 img 组件
 * 降级为链接的隐私决策不受影响。
 */
export function rehypeChatInlineImage() {
	return () => (tree: HastRoot) => {
		visit(tree, "text", (node, index, parent) => {
			if (index === undefined || !parent) return;
			const replacement = splitInlineImageText(node.value);
			if (replacement) parent.children.splice(index, 1, ...replacement);
		});
	};
}

function splitInlineImageText(text: string): ElementContent[] | null {
	INLINE_IMAGE_TOKEN.lastIndex = 0;
	let lastIndex = 0;
	let matched = false;
	const nodes: ElementContent[] = [];
	for (let match = INLINE_IMAGE_TOKEN.exec(text); match; match = INLINE_IMAGE_TOKEN.exec(text)) {
		const [fullMatch, id] = match;
		if (!id) continue;
		matched = true;
		if (match.index > lastIndex) nodes.push(textNode(text.slice(lastIndex, match.index)));
		nodes.push(inlineImageNode(id));
		lastIndex = match.index + fullMatch.length;
	}
	if (!matched) return null;
	if (lastIndex < text.length) nodes.push(textNode(text.slice(lastIndex)));
	return nodes;
}

function inlineImageNode(id: string): Element {
	return {
		type: "element",
		tagName: "img",
		properties: {
			alt: "聊天图片",
			"data-image": id,
			// 与输入框内联图片节点同尺寸同形态（见 use-rich-text-input createImageElement）
			className: [
				"inline-block",
				"size-16",
				"rounded-lg",
				"object-cover",
				"align-text-bottom",
			],
			loading: "lazy",
		},
		children: [],
	};
}

const MENTION_TOKEN = mentionTokenPattern();

/**
 * 提及占位符替换插件工厂：`@(username:id)` 转为带 data-mention 的 span 节点。
 *
 * mentions 里查不到该 token（用户已注销）时退化成 `@username` 纯文本——占位符原样
 * 吐出来不可读，而 username 段本身就是可读的。
 */
export function rehypeChatMention(
	mentions: Record<string, ChatUser> | undefined,
	viewerID: string | undefined,
) {
	return () => (tree: HastRoot) => {
		visit(tree, "text", (node, index, parent) => {
			if (index === undefined || !parent) return;
			const replacement = splitMentionText(node.value, mentions, viewerID);
			if (replacement) parent.children.splice(index, 1, ...replacement);
		});
	};
}

function splitMentionText(
	text: string,
	mentions: Record<string, ChatUser> | undefined,
	viewerID: string | undefined,
): ElementContent[] | null {
	MENTION_TOKEN.lastIndex = 0;
	let lastIndex = 0;
	let matched = false;
	const nodes: ElementContent[] = [];
	for (let match = MENTION_TOKEN.exec(text); match; match = MENTION_TOKEN.exec(text)) {
		const [fullMatch, username, userID] = match;
		matched = true;
		if (match.index > lastIndex) nodes.push(textNode(text.slice(lastIndex, match.index)));
		if (userID === MENTION_ALL.id) {
			nodes.push(
				mentionNode(MENTION_ALL.id, MENTION_ALL.username, MENTION_ALL.displayName, false),
			);
			lastIndex = match.index + fullMatch.length;
			continue;
		}
		const user = mentions?.[fullMatch];
		nodes.push(
			mentionNode(
				user?.id ?? userID,
				user?.username ?? username,
				user?.display_name || username,
				!!viewerID && (user?.id ?? userID) === viewerID,
			),
		);
		lastIndex = match.index + fullMatch.length;
	}
	if (!matched) return null;
	if (lastIndex < text.length) nodes.push(textNode(text.slice(lastIndex)));
	return nodes;
}

function mentionNode(userID: string, username: string, label: string, self: boolean): Element {
	return {
		type: "element",
		tagName: "span",
		properties: {
			"data-mention": userID,
			"data-mention-username": username,
			...(self ? { "data-mention-self": "true" } : {}),
		},
		children: [textNode(`@${label}`)],
	};
}
