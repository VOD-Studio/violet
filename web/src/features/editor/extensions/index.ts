/**
 * extensions - 富文本编辑器扩展集合
 *
 * 遵循 2026 Tiptap 最佳实践：StarterKit 聚合基础节点 + 独立扩展补充进阶能力。
 * StarterKit 内已含的节点（codeBlock/list/bold/italic 等）在此关闭，
 * 改用独立扩展以获得更高定制性（代码高亮 / 任务列表 / 颜色等）。
 *
 * Markdown 双向序列化由官方 @tiptap/markdown 扩展负责（v3 已开源），
 * 历史版本依赖 tiptap-markdown 补丁包的注记已过时删除。
 *
 * 能力裁剪：underline/color/align/table 经 ResolvedFeatures 条件注册，
 * 保证「禁用即不存在」——工具栏、斜杠菜单与扩展 schema 同步收窄。
 */

import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import type { ResolvedFeatures } from "../lib/features";
import { SlashCommand } from "../slash-menu/SlashCommand";
import { buildSlashItems } from "../slash-menu/slash-items";
import { createCodeBlockExtension } from "../ui/CodeBlockView";
import { createDiagramBlockExtension } from "../ui/DiagramBlockView";
import { createImageExtension } from "../ui/ImageView";
import { createMathExtensions } from "../ui/MathView";
import { CustomTaskItem } from "../ui/TaskItemView";

/** 低光高亮实例：common 预设已注册 37 种常用语言，其余按需动态注册 */
const lowlight = createLowlight(common);

/**
 * 已注册语言缓存。初始用 lowlight.listLanguages() 灌入 common 预设，
 * 后续动态注册的语言追加进来，避免重复 import/register。
 */
const registeredLanguages = new Set<string>(lowlight.listLanguages());

/** 动态注册进行中的语言，避免并发重复 import */
const registering = new Map<string, Promise<void>>();

/**
 * ensureLanguageRegistered - 确保指定语言已注册到 lowlight 实例。
 *
 * common 预设外的语言（dockerfile/nginx 等）首次选中时按需动态 import
 * 对应 highlight.js 语法并 register，避免一次性打包全部语法。
 * Vite 会为 `highlight.js/lib/languages/*` 生成独立 chunk 实现懒加载。
 *
 * @param id 语言 id（与 highlight.js/lib/languages/<id> 文件名一致）
 */
export async function ensureLanguageRegistered(id: string): Promise<void> {
	if (!id || id === "text" || registeredLanguages.has(id)) return;
	const pending = registering.get(id);
	if (pending) return pending;
	const p = (async () => {
		try {
			const mod = await import(/* @vite-ignore */ `highlight.js/lib/languages/${id}`);
			const grammar = mod.default;
			if (typeof grammar === "function") {
				lowlight.register(id, grammar);
				registeredLanguages.add(id);
			}
		} catch {
			// 不支持的 id 静默失败，lowlight 会回退到 highlightAuto
		} finally {
			registering.delete(id);
		}
	})();
	registering.set(id, p);
	return p;
}

export function buildEditorExtensions(
	placeholder = "开始书写，或输入 / 唤起命令菜单…",
	features?: ResolvedFeatures,
) {
	return [
		StarterKit.configure({
			// 关闭 StarterKit 内置项，改用下方独立扩展以获得更高定制性
			codeBlock: false,
			link: false,
			// Tiptap v3 的 StarterKit 默认已包含 underline，
			// 需显式关闭，避免与下方独立 Underline 扩展重复注册。
			underline: false,
			// 保留：文档/段落/文本/标题/粗斜/删除线/行内代码/引用/分割线/
			//       有序无序列表/列表项/历史/拖放/粘贴等
		}),
		// —— 文本样式（underline/color 可裁剪：Markdown 无原生语法，存回丢语义）——
		TextStyle,
		...(features?.underline === false ? [] : [Underline]),
		...(features?.color === false ? [] : [Color]),
		Highlight.configure({ multicolor: true }),
		// —— 文本对齐（可裁剪）——
		...(features?.align === false
			? []
			: [TextAlign.configure({ types: ["heading", "paragraph"] })]),
		// —— 链接与图片 ——
		Link.configure({
			openOnClick: false,
			autolink: true,
			HTMLAttributes: {
				rel: "noopener noreferrer nofollow",
				target: "_blank",
				class: "text-primary underline underline-offset-2",
			},
		}),
		// 图片:自定义 NodeView,编辑时显示 w=1200 缩略,序列化仍输出原图
		createImageExtension().configure({
			inline: false,
			allowBase64: false,
			HTMLAttributes: { class: "rounded-lg" },
		}),
		// —— 列表 ——
		TaskList,
		CustomTaskItem,
		// —— 表格（可裁剪）——
		...(features?.table === false
			? []
			: [Table.configure({ resizable: false }), TableRow, TableHeader, TableCell]),
		// —— 代码块（高亮 + 语言下拉 nodeView）——
		createCodeBlockExtension(lowlight),
		// —— 数学公式（KaTeX 双态编辑，宏表与阅读端同源）——
		...createMathExtensions(),
		// —— 图块（Mermaid 流程图，atom 节点 + ```mermaid 围栏往返 + 弹层 NodeView）——
		createDiagramBlockExtension(),
		// —— 占位符 ——
		Placeholder.configure({ placeholder }),
		// —— Markdown 双向序列化 ——
		Markdown.configure({
			indentation: { style: "space", size: 4 },
		}),
	];
}

/**
 * buildEditorExtensionsWithSlash - 含斜杠命令的扩展集合
 *
 * @param onPickImage 斜杠菜单「图片」项的回调
 * @param placeholder 占位符文案
 * @param features 能力集（透传给 buildEditorExtensions 与斜杠菜单）
 */
export function buildEditorExtensionsWithSlash(
	onPickImage: () => void,
	placeholder = "开始书写，或输入 / 唤起命令菜单…",
	features?: ResolvedFeatures,
) {
	return [
		...buildEditorExtensions(placeholder, features).filter((e) => e.name !== "slashCommand"),
		SlashCommand.configure({
			onPickImage,
			items: (cb) => buildSlashItems(cb, features),
		}),
	];
}

/** lowlight 实例导出，供代码块样式 / 语言列表复用 */
export { lowlight };
