/**
 * useRichTextInput - contentEditable 富文本输入 Hook
 *
 * 管理 contentEditable div 的核心逻辑：
 * - DOM ↔ Markdown 双向转换（[name] ↔ img/span 元素，![img:id] ↔ 图片节点）
 * - Selection/Range API 管理光标位置
 * - emoji / 图片插入到光标处
 * - 粘贴强制纯文本
 * - Cmd/Ctrl+Enter 触发提交
 * - 受控同步：外部 value 变化时同步 DOM，用户输入时不重置光标
 *
 * emoji 查表使用 useAllEmojis 构建 name→Emoji 映射。
 * 图片表情用 <img data-emoji>，颜文字用 <span data-emoji>。
 * 内嵌图片（仅 inlineImages 消费方使用）用 data-image 标记：上传中/失败态是
 * contentEditable=false 的 <span>（叠加进度/失败态，可能有覆盖层子节点，需禁用
 * 编辑保证退格整体删除）；完成态是纯 <img>（与 emoji 图片节点同构，无子节点天然原子）。
 */

import type { Emoji } from "@entities/emoji/model/types";
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
	/** 剪贴板粘贴图片文件回调 */
	onPasteFiles?: (files: File[]) => void;
	/** 按 id 查已上传图片的真实 URL，供 markdownToHtml 从 `![img:<id>]` 占位符还原图片节点（仅 inlineImages 消费方需要） */
	resolveImage?: (id: string) => string | undefined;
	/** 内嵌图片节点处于失败态被点击移除时的回调 */
	onImageRemove?: (id: string) => void;
}

export type ImageNodeStatus = "uploading" | "done" | "error";

export interface UseRichTextInputReturn {
	contentRef: React.RefObject<HTMLDivElement | null>;
	insertEmoji: (name: string, display: string, size?: number) => void;
	/** 在光标处插入/原地更新一个内嵌图片节点；同一 id 重复调用会替换已有节点（uploading → done/error） */
	insertImage: (id: string, url: string, status: ImageNodeStatus) => void;
	handleInput: () => void;
	handlePaste: (e: React.ClipboardEvent) => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	clear: () => void;
	focus: () => void;
}

/** 匹配 `![img:<id>]` 图片占位符或 `[name]` emoji 占位符；图片分支优先，二者互不误吃。 */
const TOKEN_PATTERN = /!\[img:([^\]]+)\]|\[([^\]]+)\]/g;

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
	onPasteFiles,
	resolveImage,
	onImageRemove,
}: UseRichTextInputOptions): UseRichTextInputReturn {
	const contentRef = useRef<HTMLDivElement>(null);
	const lastSyncedRef = useRef("");
	const onChangeRef = useRef(onChange);
	const onSubmitRef = useRef(onSubmit);
	const resolveImageRef = useRef(resolveImage);
	const onImageRemoveRef = useRef(onImageRemove);
	onChangeRef.current = onChange;
	onSubmitRef.current = onSubmit;
	resolveImageRef.current = resolveImage;
	onImageRemoveRef.current = onImageRemove;

	const { data: groups = [] } = useAllEmojis();

	const emojiMap = useMemo(() => {
		const map = new Map<string, Emoji>();
		for (const group of groups) {
			for (const emoji of group.emojis) {
				map.set(emoji.name, emoji);
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
				const [fullMatch, imageId, emojiToken] = match;
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
						// 上传中/失败态节点不参与序列化，只有上传完成的图片才计入 value。
						if (el.dataset.imageStatus === "done") {
							markdown += `![img:${imageId}]`;
						}
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
	}, []);

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
		(id: string, url: string, status: ImageNodeStatus) => {
			const div = contentRef.current;
			if (!div || disabled) return;

			const existing = div.querySelector<HTMLElement>(
				`[data-image="${escapeAttributeSelectorValue(id)}"]`,
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
				existing.replaceWith(element);
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

	const handleInput = useCallback(() => {
		const markdown = htmlToMarkdown();
		lastSyncedRef.current = markdown;
		onChangeRef.current?.(markdown);
	}, [htmlToMarkdown]);

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

	const focus = useCallback(() => {
		contentRef.current?.focus();
	}, []);

	return {
		contentRef,
		insertEmoji,
		insertImage,
		handleInput,
		handlePaste,
		handleKeyDown,
		clear,
		focus,
	};
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
