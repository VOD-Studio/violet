/**
 * useRichTextInput - contentEditable 富文本输入 Hook
 *
 * 管理 contentEditable div 的核心逻辑：
 * - DOM ↔ Markdown 双向转换（[name] ↔ img/span 元素，![img:id] ↔ 图片节点，@(username:id) ↔ 提及节点）
 * - Selection/Range API 管理光标位置
 * - emoji / 图片插入到光标处
 * - 粘贴强制纯文本
 * - Cmd/Ctrl+Enter 触发提交
 * - 受控同步：外部 value 变化时同步 DOM，用户输入时不重置光标
 *
 * emoji 查表使用 useAllEmojis 构建 token→Emoji 映射。
 * 图片表情用 <img data-emoji>，颜文字用 <span data-emoji>。
 * 内嵌图片（仅 inlineImages 消费方使用）用 data-image 标记：上传中/失败态是
 * contentEditable=false 的 <span>（叠加进度/失败态，可能有覆盖层子节点，需禁用
 * 编辑保证退格整体删除）；完成态是纯 <img>（与 emoji 图片节点同构，无子节点天然原子）。
 * @ 提及（仅传入 mentionCandidates 的消费方使用）用 data-mention 标记：contentEditable=false
 * 的 <span>，无子节点天然原子，序列化回 @(username:userID) 占位符。
 */

import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji } from "@entities/emoji/model/types";
import {
	humanizeMentionTokens,
	MENTION_ALL,
	mentionTokenPattern,
} from "@entities/user/model/mention-token";
import { useAllEmojis } from "@features/emojis/api/queries";
import { isImageURL } from "@shared/lib/url";
import { cn } from "@shared/lib/utils";
import { useCallback, useEffect, useMemo, useRef } from "react";

export interface UseRichTextInputOptions {
	value: string;
	onChange?: (markdown: string) => void;
	onSubmit?: () => void;
	disabled?: boolean;
	/** 是否按 Enter 键即提交（Shift+Enter 换行），默认 false（仅 Ctrl/Cmd+Enter 提交） */
	submitOnEnter?: boolean;
	/** 上传中与失败图片也输出本地占位符，供提交方接管上传任务。 */
	includePendingImages?: boolean;
	/** 剪贴板粘贴图片文件回调 */
	onPasteFiles?: (files: File[]) => void;
	/** 按 id 查已上传图片的真实 URL，供 markdownToHtml 从 `![img:<id>]` 占位符还原图片节点（仅 inlineImages 消费方需要） */
	resolveImage?: (id: string) => string | undefined;
	/** 内嵌图片节点处于失败态被点击移除时的回调 */
	onImageRemove?: (id: string) => void;
	/** 按用户 ID 查提及展示名，供 markdownToHtml 从 `@(username:id)` 占位符还原提及节点；查不到时回退 token 里的 username */
	resolveMention?: (userID: string) => string | undefined;
	/** 光标前的 `@查询词` 变化回调；null 表示光标已离开提及触发态 */
	onMentionQueryChange?: (query: string | null) => void;
	onSlashQueryChange?: (query: string | null) => void;
}

export type ImageNodeStatus = "uploading" | "done" | "error";

export interface UseRichTextInputReturn {
	contentRef: React.RefObject<HTMLDivElement | null>;
	insertEmoji: (name: string, display: string, size?: number) => void;
	/** 在光标处插入/原地更新一个内嵌图片节点；同一 id 重复调用会替换已有节点（uploading → done/error）。
	 * replaceId 传入时按它定位旧节点替换为新 id 节点（上传完成把本地 uuid 换键为服务端 file_id）。 */
	insertImage: (id: string, url: string, status: ImageNodeStatus, replaceId?: string) => void;
	/** 在光标处插入提及节点，同时吃掉触发它的 `@查询词` 文本 */
	insertMention: (userID: string, username: string, displayName: string) => void;
	replaceSlashQuery: (
		command: string,
		mention?: { id: string; username: string; displayName: string },
	) => boolean;
	prependMention: (userID: string, username: string, displayName: string) => void;
	refreshQueries: () => void;
	handleInput: () => void;
	handlePaste: (e: React.ClipboardEvent) => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	clear: () => void;
	focus: () => void;
}

/**
 * 匹配 `![img:<id>]` 图片占位符、`[name]` emoji 占位符或 `@(username:id)` 提及占位符；
 * 图片分支优先，三者互不误吃。捕获组依次为图片 id、emoji token 内容、提及 username、提及 userID。
 */
const TOKEN_PATTERN = new RegExp(
	`!\\[img:([^\\]]+)\\]|\\[([^\\]]+)\\]|${mentionTokenPattern().source}`,
	"g",
);

/** 提及节点样式：insertMention 造的节点与 markdownToHtml 还原的节点共用一套类名。 */
const MENTION_NODE_CLASS = "rounded bg-primary/10 px-1 font-medium text-primary";

/** 单独匹配图片占位符，供 extractImageIds 复用。 */
const IMAGE_TOKEN_PATTERN = /!\[img:([^\]]+)\]/g;

/** 提取 markdown 中按出现顺序排列的图片 id 列表（用于按文字流位置排序已上传图片）。 */
export function extractImageIds(markdown: string): string[] {
	const ids: string[] = [];
	IMAGE_TOKEN_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null = IMAGE_TOKEN_PATTERN.exec(markdown);
	while (match !== null) {
		ids.push(match[1]);
		match = IMAGE_TOKEN_PATTERN.exec(markdown);
	}
	return ids;
}

/** 剥离 markdown 中的 `![img:<id>]` 图片占位符，只留文字部分（供图文合一发送场景剥离 caption 草稿复用）。 */
export function stripImagePlaceholders(markdown: string): string {
	return markdown.replace(IMAGE_TOKEN_PATTERN, "");
}

/** 匹配表情占位符：系统表情 `[name]` 或自定义表情 `[name:uuid]`（含方括号）。 */
const EMOJI_PLACEHOLDER_PATTERN = /\[([^\]]+)\]/g;

/**
 * 剥离 markdown 中的图片占位符与表情占位符、把提及占位符还原成 `@username`，只留
 * 可读文字——供无 emote 映射可查的纯文本预览场景复用（回复/引用预览、会话列表最后
 * 一条消息摘要）：这些场景拿不到表情解析结果，裸吐占位符文本（如 `[1:<uuid>]`）不
 * 可读，剥离比展示更合适；提及不同，`@username` 本身就是可读的。
 * 顺序不可换：先剥图片再剥表情——图片占位符自身形如 `[img:<id>]`，颠倒顺序会把
 * 开头的 `!` 落单残留。
 */
export function stripPlaceholdersForPreview(markdown: string): string {
	return humanizeMentionTokens(
		stripImagePlaceholders(markdown).replace(EMOJI_PLACEHOLDER_PATTERN, ""),
	);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * 转义 `[data-image="<value>"]` 属性选择器里的引号/反斜杠。不依赖全局 `CSS.escape`——
 * jsdom 测试环境未实现该 API；生产环境 id 均为 crypto.randomUUID()，本就不含特殊字符。
 */
function escapeAttributeSelectorValue(value: string): string {
	return value.replace(/["\\]/g, "\\$&");
}

export function useRichTextInput({
	value,
	onChange,
	onSubmit,
	disabled,
	submitOnEnter = false,
	includePendingImages = false,
	onPasteFiles,
	resolveImage,
	onImageRemove,
	resolveMention,
	onMentionQueryChange,
	onSlashQueryChange,
}: UseRichTextInputOptions): UseRichTextInputReturn {
	const contentRef = useRef<HTMLDivElement>(null);
	const lastSyncedRef = useRef("");
	const onChangeRef = useRef(onChange);
	const onSubmitRef = useRef(onSubmit);
	const resolveImageRef = useRef(resolveImage);
	const onImageRemoveRef = useRef(onImageRemove);
	const resolveMentionRef = useRef(resolveMention);
	const onMentionQueryChangeRef = useRef(onMentionQueryChange);
	const onSlashQueryChangeRef = useRef(onSlashQueryChange);
	onChangeRef.current = onChange;
	onSubmitRef.current = onSubmit;
	resolveImageRef.current = resolveImage;
	onImageRemoveRef.current = onImageRemove;
	resolveMentionRef.current = resolveMention;
	onMentionQueryChangeRef.current = onMentionQueryChange;
	onSlashQueryChangeRef.current = onSlashQueryChange;

	const { data: groups = [] } = useAllEmojis();

	const emojiMap = useMemo(() => {
		const map = new Map<string, Emoji>();
		for (const group of groups) {
			for (const emoji of group.emojis) {
				map.set(toEmojiToken(emoji), emoji);
			}
		}
		return map;
	}, [groups]);

	const markdownToHtml = useCallback(
		(markdown: string): string => {
			if (!markdown) return "";
			let html = "";
			let lastIndex = 0;
			TOKEN_PATTERN.lastIndex = 0;
			let match: RegExpExecArray | null = TOKEN_PATTERN.exec(markdown);
			while (match !== null) {
				const [fullMatch, imageId, emojiToken, mentionUsername, mentionUserID] = match;
				if (match.index > lastIndex) {
					html += escapeHtml(markdown.slice(lastIndex, match.index)).replace(
						/\n/g,
						"<br>",
					);
				}
				if (imageId !== undefined) {
					const url = resolveImageRef.current?.(imageId);
					// 未知/已失效的图片 id 没有可展示的 URL，静默丢弃该占位符。
					if (url) {
						html += `<img src="${escapeHtml(url)}" alt="图片" data-image="${escapeHtml(imageId)}" data-image-status="done" class="inline-block size-16 rounded-lg object-cover align-text-bottom" draggable="false" />`;
					}
				} else if (emojiToken !== undefined) {
					const emoji = emojiMap.get(fullMatch);
					const url = emoji ? emoji.gif_url || emoji.url : "";
					if (url && isImageURL(url)) {
						const sizeClass = emoji?.meta?.size === 2 ? "size-10" : "size-5";
						html += `<img src="${url}" alt="${escapeHtml(fullMatch)}" data-emoji="${escapeHtml(fullMatch)}" class="inline-block align-text-bottom ${sizeClass}" draggable="false" />`;
					} else {
						const text = emoji?.text_content || fullMatch;
						html += `<span data-emoji="${escapeHtml(fullMatch)}">${escapeHtml(text)}</span>`;
					}
				} else if (mentionUserID !== undefined && mentionUsername !== undefined) {
					const display =
						mentionUserID === MENTION_ALL.id
							? MENTION_ALL.displayName
							: resolveMentionRef.current?.(mentionUserID) || mentionUsername;
					html += `<span data-mention="${escapeHtml(mentionUserID)}" data-mention-username="${escapeHtml(mentionUsername)}" contenteditable="false" class="${MENTION_NODE_CLASS}">@${escapeHtml(display)}</span>`;
				}
				lastIndex = match.index + fullMatch.length;
				match = TOKEN_PATTERN.exec(markdown);
			}
			if (lastIndex < markdown.length) {
				html += escapeHtml(markdown.slice(lastIndex)).replace(/\n/g, "<br>");
			}
			return html;
		},
		[emojiMap],
	);

	const htmlToMarkdown = useCallback((): string => {
		const div = contentRef.current;
		if (!div) return "";
		let markdown = "";
		const traverse = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				markdown += node.textContent || "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement;
				if (el.tagName === "IMG" || el.tagName === "SPAN") {
					const imageId = el.dataset.image;
					if (imageId) {
						// 普通表单只提交已上传图片；任务接管方需要保留本地占位符。
						if (includePendingImages || el.dataset.imageStatus === "done") {
							markdown += `![img:${imageId}]`;
						}
						return;
					}
					const mentionUserID = el.dataset.mention;
					if (mentionUserID) {
						markdown += `@(${el.dataset.mentionUsername}:${mentionUserID})`;
						return;
					}
					const emojiName = el.dataset.emoji;
					if (emojiName) {
						markdown += emojiName;
					}
				} else if (el.tagName === "BR") {
					markdown += "\n";
				} else if (el.tagName === "DIV") {
					if (markdown && !markdown.endsWith("\n")) {
						markdown += "\n";
					}
					el.childNodes.forEach(traverse);
				} else {
					el.childNodes.forEach(traverse);
				}
			}
		};
		div.childNodes.forEach(traverse);
		return markdown;
	}, [includePendingImages]);

	const syncToDom = useCallback(
		(markdown: string) => {
			if (contentRef.current) {
				contentRef.current.innerHTML = markdownToHtml(markdown);
				lastSyncedRef.current = markdown;
			}
		},
		[markdownToHtml],
	);

	// 外部 value 变化时同步 DOM（用户输入触发的变化不重置）
	useEffect(() => {
		if (value !== lastSyncedRef.current) {
			syncToDom(value);
		}
	}, [value, syncToDom]);

	const insertEmoji = useCallback(
		(name: string, display: string, size?: number) => {
			const div = contentRef.current;
			if (!div || disabled) return;
			div.focus();

			const element = createEmojiElement(name, display, size);

			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0 || !div.contains(selection.anchorNode)) {
				div.appendChild(element);
			} else {
				const range = selection.getRangeAt(0);
				range.deleteContents();
				range.insertNode(element);
				range.setStartAfter(element);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}

			lastSyncedRef.current = htmlToMarkdown();
			onChangeRef.current?.(lastSyncedRef.current);
		},
		[disabled, htmlToMarkdown],
	);

	const insertImage = useCallback(
		(id: string, url: string, status: ImageNodeStatus, replaceId?: string) => {
			const div = contentRef.current;
			if (!div || disabled) return;

			const existing = div.querySelector<HTMLElement>(
				`[data-image="${escapeAttributeSelectorValue(replaceId ?? id)}"]`,
			);
			const element = createImageElement(id, url, status, (removedId) => {
				contentRef.current
					?.querySelector<HTMLElement>(
						`[data-image="${escapeAttributeSelectorValue(removedId)}"]`,
					)
					?.remove();
				lastSyncedRef.current = htmlToMarkdown();
				onChangeRef.current?.(lastSyncedRef.current);
				onImageRemoveRef.current?.(removedId);
			});

			if (existing) {
				// replaceWith 的 Range 调整是"remove 后 insert"两步：紧贴旧节点右侧的光标
				// 在 remove 时 offset 减 1，insert 时因 offset == index 不加回——净效果是光标
				// 滑到新节点左侧。替换前记住这一位置关系，替换后把光标补回新节点右侧；
				// 光标在别处（上传期间继续打字/点选）则不抢。
				const selection = window.getSelection();
				const range =
					selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
				const caretAfterExisting =
					range?.collapsed &&
					range.startContainer === existing.parentNode &&
					existing.parentNode?.childNodes[range.startOffset - 1] === existing;
				existing.replaceWith(element);
				if (caretAfterExisting && selection && range) {
					range.setStartAfter(element);
					range.collapse(true);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			} else {
				div.focus();
				const selection = window.getSelection();
				if (
					!selection ||
					selection.rangeCount === 0 ||
					!div.contains(selection.anchorNode)
				) {
					div.appendChild(element);
				} else {
					const range = selection.getRangeAt(0);
					range.deleteContents();
					range.insertNode(element);
					range.setStartAfter(element);
					range.collapse(true);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			}

			lastSyncedRef.current = htmlToMarkdown();
			onChangeRef.current?.(lastSyncedRef.current);
		},
		[disabled, htmlToMarkdown],
	);

	const insertMention = useCallback(
		(userID: string, username: string, displayName: string) => {
			const div = contentRef.current;
			if (!div || disabled) return;
			div.focus();

			const element = createMentionElement(userID, username, displayName);
			// 提及节点后补一个空格：紧接着打字不会粘在药丸上，也给了光标一个落点。
			// 用 NBSP 而非普通空格——行尾的普通空格会被浏览器折叠掉，随后打字就贴上去了；
			// NBSP 参与 trim（提及独占一条消息时不会留白），也算 \s（后面再打 @ 仍能触发候选）。
			const spacer = document.createTextNode("\u00a0");

			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0 || !div.contains(selection.anchorNode)) {
				div.append(element, spacer);
			} else {
				const range = selection.getRangeAt(0);
				// 触发候选浮层的 "@查询词" 仍是普通文本，插入前先吃掉，否则与提及节点重复。
				const container = range.startContainer;
				if (container.nodeType === Node.TEXT_NODE) {
					const text = container.textContent ?? "";
					const at = text.lastIndexOf("@", Math.max(range.startOffset - 1, 0));
					if (at >= 0) range.setStart(container, at);
				}
				range.deleteContents();
				range.insertNode(spacer);
				range.insertNode(element);
				range.setStartAfter(spacer);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}

			lastSyncedRef.current = htmlToMarkdown();
			onChangeRef.current?.(lastSyncedRef.current);
			onMentionQueryChangeRef.current?.(null);
		},
		[disabled, htmlToMarkdown],
	);

	const refreshQueries = useCallback(() => {
		const div = contentRef.current;
		if (!div) return;
		onMentionQueryChangeRef.current?.(activeMentionQuery(div));
		onSlashQueryChangeRef.current?.(
			htmlToMarkdown().startsWith("/") ? (leadingSlashRange(div)?.query ?? null) : null,
		);
	}, [htmlToMarkdown]);

	const handleInput = useCallback(() => {
		const markdown = htmlToMarkdown();
		lastSyncedRef.current = markdown;
		onChangeRef.current?.(markdown);
		refreshQueries();
	}, [htmlToMarkdown, refreshQueries]);

	const replaceSlashQuery = useCallback(
		(command: string, mention?: { id: string; username: string; displayName: string }) => {
			const div = contentRef.current;
			if (!div || disabled || !htmlToMarkdown().startsWith("/")) return false;
			const active = leadingSlashRange(div);
			if (!active) return false;
			const range = active.range;
			range.deleteContents();
			const fragment = document.createDocumentFragment();
			if (mention) {
				fragment.append(
					createMentionElement(mention.id, mention.username, mention.displayName),
				);
				fragment.append(document.createTextNode(" "));
			}
			const text = document.createTextNode(command);
			fragment.append(text);
			range.insertNode(fragment);
			range.setStartAfter(text);
			range.collapse(true);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			div.focus();
			lastSyncedRef.current = htmlToMarkdown();
			onChangeRef.current?.(lastSyncedRef.current);
			onMentionQueryChangeRef.current?.(null);
			onSlashQueryChangeRef.current?.(null);
			return true;
		},
		[disabled, htmlToMarkdown],
	);

	const prependMention = useCallback(
		(userID: string, username: string, displayName: string) => {
			const div = contentRef.current;
			if (!div || disabled) return;
			const range = document.createRange();
			range.selectNodeContents(div);
			range.collapse(true);
			const fragment = document.createDocumentFragment();
			fragment.append(createMentionElement(userID, username, displayName));
			fragment.append(document.createTextNode(" "));
			range.insertNode(fragment);
			lastSyncedRef.current = htmlToMarkdown();
			onChangeRef.current?.(lastSyncedRef.current);
			focusEditorEnd(div);
		},
		[disabled, htmlToMarkdown],
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const files = Array.from(e.clipboardData.files || []);
			const imageFiles = files.filter((file) => file.type.startsWith("image/"));
			if (imageFiles.length > 0 && onPasteFiles) {
				e.preventDefault();
				onPasteFiles(imageFiles);
				return;
			}

			e.preventDefault();
			const text = e.clipboardData.getData("text/plain");
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;
			const range = selection.getRangeAt(0);
			range.deleteContents();
			const textNode = document.createTextNode(text);
			range.insertNode(textNode);
			range.setStartAfter(textNode);
			range.setEndAfter(textNode);
			selection.removeAllRanges();
			selection.addRange(range);
			handleInput();
		},
		[handleInput, onPasteFiles],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// 正在使用中文输入法合成字时忽略回车
			if (e.nativeEvent.isComposing) return;

			if (submitOnEnter) {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					onSubmitRef.current?.();
					return;
				}
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				onSubmitRef.current?.();
			}
		},
		[submitOnEnter],
	);
	const clear = useCallback(() => {
		if (contentRef.current) {
			contentRef.current.innerHTML = "";
		}
		lastSyncedRef.current = "";
		onChangeRef.current?.("");
	}, []);

	// 光标落到内容末尾：编辑场景（预填正文）里裸 focus() 会把插入点留在首字符前，
	// 用户续打字会插到句首。
	const focus = useCallback(() => {
		const div = contentRef.current;
		if (!div) return;
		div.focus();
		const selection = window.getSelection();
		if (!selection) return;
		const range = document.createRange();
		range.selectNodeContents(div);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}, []);

	return {
		contentRef,
		insertEmoji,
		insertImage,
		insertMention,
		replaceSlashQuery,
		prependMention,
		refreshQueries,
		handleInput,
		handlePaste,
		handleKeyDown,
		clear,
		focus,
	};
}

function leadingSlashRange(root: HTMLElement): { range: Range; query: string } | null {
	const selection = window.getSelection();
	if (!selection?.isCollapsed || selection.rangeCount === 0) return null;
	const caret = selection.getRangeAt(0);
	if (!root.contains(caret.startContainer)) return null;
	const range = document.createRange();
	range.selectNodeContents(root);
	range.setEnd(caret.startContainer, caret.startOffset);
	const prefix = range.toString();
	return /^\/[^\n]{0,80}$/.test(prefix) ? { range, query: prefix.slice(1) } : null;
}

function focusEditorEnd(root: HTMLElement): void {
	root.focus();
	const range = document.createRange();
	range.selectNodeContents(root);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

/**
 * 提及节点：contentEditable=false 的 <span>，无子节点，退格一次整体删除。
 * data-mention 存用户 ID（序列化依据），data-mention-username 存用户名（解析兜底）。
 */
function createMentionElement(userID: string, username: string, displayName: string): HTMLElement {
	const span = document.createElement("span");
	span.textContent = `@${displayName || username}`;
	span.dataset.mention = userID;
	span.dataset.mentionUsername = username;
	span.contentEditable = "false";
	span.className = MENTION_NODE_CLASS;
	return span;
}

/**
 * 光标前正在输入的 `@查询词`；null 表示光标不处于提及触发态。
 *
 * 触发条件：`@` 位于文本节点开头或空白之后（词首），且其后到光标之间没有空白与第二个 `@`。
 */
function activeMentionQuery(root: HTMLElement): string | null {
	const selection = window.getSelection();
	if (!selection?.isCollapsed || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	const container = range.startContainer;
	if (container.nodeType !== Node.TEXT_NODE || !root.contains(container)) return null;
	const before = (container.textContent ?? "").slice(0, range.startOffset);
	const match = /(?:^|\s)@([^\s@]{0,32})$/.exec(before);
	return match ? match[1] : null;
}

function createEmojiElement(name: string, display: string, size?: number): HTMLElement {
	if (display && isImageURL(display)) {
		const img = document.createElement("img");
		img.src = display;
		img.alt = name;
		img.dataset.emoji = name;
		img.className = `inline-block align-text-bottom ${size === 2 ? "size-10" : "size-5"}`;
		img.draggable = false;
		return img;
	}
	const span = document.createElement("span");
	span.textContent = display || name;
	span.dataset.emoji = name;
	span.className = "inline-block";
	return span;
}

/**
 * 内嵌图片节点。done 态是纯 <img>（与 emoji 图片节点同构，无子节点天然原子）；
 * uploading/error 态需要叠加层子节点（进度点/失败标记），故用 contentEditable=false
 * 的 <span> 包一层——否则光标可能落入叠加层内部子节点，退格无法一次整体删除。
 */
function createImageElement(
	id: string,
	url: string,
	status: ImageNodeStatus,
	onRemove?: (id: string) => void,
): HTMLElement {
	if (status === "done") {
		const img = document.createElement("img");
		img.src = url;
		img.alt = "图片";
		img.dataset.image = id;
		img.dataset.imageStatus = status;
		img.className = "inline-block size-16 rounded-lg object-cover align-text-bottom";
		img.draggable = false;
		return img;
	}

	const span = document.createElement("span");
	span.dataset.image = id;
	span.dataset.imageStatus = status;
	span.contentEditable = "false";
	span.className = cn(
		"relative inline-block size-16 shrink-0 rounded-lg bg-cover bg-center align-text-bottom",
		status === "error" && "cursor-pointer ring-2 ring-destructive/60",
	);
	if (url) span.style.backgroundImage = `url(${url})`;
	span.title = status === "uploading" ? "上传中…" : "上传失败，点击移除";
	span.innerHTML =
		status === "uploading"
			? '<span class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/25"><span class="size-2 animate-pulse rounded-full bg-white/90"></span></span>'
			: '<span class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-xs text-white">✕</span>';
	if (status === "error" && onRemove) {
		span.addEventListener("click", () => onRemove(id));
	}
	return span;
}
