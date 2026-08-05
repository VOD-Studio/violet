/**
 * DiagramPopoverView - 图块弹层编辑视图
 *
 * 弹层编辑（ADR-0005 模型，1:1 参照 MathPopoverView）：
 * - 文档内 NodeViewWrapper 永远只显示渲染结果（renderMermaid，与阅读端同核心，
 *   所见即所得）；点击进入 NodeSelection。
 * - 选中后弹出跟随定位的浮层（DiagramEditPanel：等宽 textarea 源码输入 + 实时
 *   预览 + 删除按钮），Esc/点击外部关闭，关闭后光标移到图块之后。
 *
 * 复用数学公式已验证的浮层基础设施：
 * - useFloatingMathPanel：@floating-ui/dom absolute 策略 + offset/flip/shift，
 *   Portal 渲染进编辑器滚动容器（受 overflow 裁剪、跟随滚动）
 * - 开闭用独立 popoverOpen state（不直接绑 Tiptap selected）：selected 下降沿
 *   rAF 延迟一帧确认 PM selection 确实不再选中此节点，跳过 handleSelectionUpdate
 *   竞态导致的短暂假 deselectNode
 * - source 更新走 updateDiagramSource（同事务重建 NodeSelection，复刻 update-math-latex）
 *
 * 与公式的差异：mermaid 渲染异步（useMermaidSvg），预览有 loading/error 态；
 * 编辑器内渲染同样经 DOMPurify 双重清理（作者可能粘贴外部 mermaid 源，不豁免）。
 *
 * 由 createDiagramBlockExtension（DiagramBlockView）以 .extend({ addNodeView }) 挂载。
 */
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloatingMathPanel } from "../hooks/useFloatingMathPanel";
import { useIsDarkTheme } from "../hooks/useIsDarkTheme";
import { useMermaidSvg } from "../hooks/useMermaidSvg";
import { updateDiagramSource } from "../lib/update-diagram-source";
import { DiagramEditPanel } from "./DiagramEditPanel";

/** 从编辑器 DOM 向上找滚动容器（与 MathPopoverView 同款，BubbleMenu 通用手法） */
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
	let node = el?.parentElement;
	while (node) {
		const cs = getComputedStyle(node);
		if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
}

export function DiagramPopoverView({ node, selected, editor, getPos }: NodeViewProps) {
	const source = node.attrs.source as string;
	const format = (node.attrs.format as string) || "mermaid";
	const isDark = useIsDarkTheme();
	// 文档内渲染与面板预览共用同一份渲染结果（同一 source+theme）：
	// 一次 renderMermaid 同时供给 NodeViewWrapper 占位与 DiagramEditPanel 预览。
	const render = useMermaidSvg(source, isDark ? "dark" : "light");
	const pos = typeof getPos === "function" ? getPos() : null;

	const [popoverOpen, setPopoverOpen] = useState(false);

	// 开闭契约（与 MathPopoverView 一致）：selected 上升即开；
	// 下降沿 rAF 延迟一帧确认 PM selection 确实不再选中此节点，跳过假 deselectNode。
	useEffect(() => {
		if (selected) {
			// 只对锚在本节点的 NodeSelection 开窗（同 MathPopoverView）：
			// selected 用区间覆盖判断，Ctrl+A 全选 / 拖选经过时所有图块
			// selected 同为 true，若据此开窗会 N 个弹窗齐开卡死页面。
			const sel = editor.state.selection;
			if (typeof pos === "number" && sel instanceof NodeSelection && sel.from === pos) {
				setPopoverOpen(true);
			}
			return;
		}
		const id = requestAnimationFrame(() => {
			const sel = editor.state.selection;
			const stillSelected =
				typeof pos === "number" && sel.from <= pos && sel.to >= pos + node.nodeSize;
			if (!stillSelected) {
				setPopoverOpen(false);
			}
		});
		return () => cancelAnimationFrame(id);
	}, [selected, editor, node, pos]);

	const close = () => {
		setPopoverOpen(false);
		if (typeof pos === "number") editor.commands.focus(pos + node.nodeSize);
	};

	const handleDelete = () => {
		if (typeof pos !== "number") return;
		// atom 节点被弹层抢焦点，Backspace 不可用——显式 setNodeSelection + deleteSelection
		editor.chain().setNodeSelection(pos).deleteSelection().focus().run();
	};

	const changeSource = (v: string) => {
		editor.commands.command(({ tr }) => {
			const p = typeof getPos === "function" ? getPos() : null;
			if (typeof p !== "number") return false;
			updateDiagramSource(tr, p, v);
			return true;
		});
	};

	const anchorRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	// 滚动容器：浮层 Portal 目标，也是 floating-ui 的定位边界
	const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setScrollContainer(findScrollContainer(editor.view.dom));
	}, [editor]);

	const position = useFloatingMathPanel(popoverOpen, anchorRef, panelRef, editor);

	// 点击外部 / Esc 关闭（与 MathPopoverView 一致）
	// biome-ignore lint/correctness/useExhaustiveDependencies: close 闭包捕获 pos，依赖 [popoverOpen] 足够
	useEffect(() => {
		if (!popoverOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (panelRef.current?.contains(target)) return;
			if (anchorRef.current?.contains(target)) return;
			setPopoverOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [popoverOpen]);

	const panel =
		popoverOpen && scrollContainer
			? createPortal(
					<div
						ref={panelRef}
						style={position ? { top: position.top, left: position.left } : undefined}
						className="absolute z-50 w-auto rounded-md border border-edge-hairline bg-popover p-3 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
					>
						<DiagramEditPanel
							source={source}
							render={render}
							onChange={changeSource}
							onClose={close}
							onDelete={handleDelete}
						/>
					</div>,
					scrollContainer,
				)
			: null;

	return (
		<NodeViewWrapper
			ref={anchorRef}
			as="div"
			data-type="diagram-block"
			data-format={format}
			className={`diagram-node-view${selected ? " diagram-node-view--selected" : ""}`}
			onClick={() => {
				if (typeof pos === "number") editor.chain().setNodeSelection(pos).run();
			}}
		>
			{/* 文档内渲染：与阅读端同核心（renderMermaid + DOMPurify 双重防线） */}
			{render.svg ? (
				<div
					className="diagram-node-view__render [&>svg]:max-w-full [&>svg]:h-auto"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: svg 经 renderMermaid 内 DOMPurify 清理：svg/svgFilters profile + foreignObject 内纯文本 HTML 白名单（div/span/p 等，无 href/src 能力）+ FORBID script/a + on* 事件属性与 CSS url() 剥除，与阅读端同防线；PRD 决议 mermaid SVG 不走 hast 白名单
					dangerouslySetInnerHTML={{ __html: render.svg }}
				/>
			) : render.error ? (
				<div className="diagram-node-view__fault text-xs text-muted-foreground">
					图表渲染失败，点击查看错误
				</div>
			) : (
				<div className="diagram-node-view__placeholder text-xs text-muted-foreground">
					{source.trim() ? "渲染中…" : "Mermaid 流程图（点击编辑源码）"}
				</div>
			)}
			{panel}
		</NodeViewWrapper>
	);
}
