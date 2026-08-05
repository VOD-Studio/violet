/**
 * MathPopoverView - 公式弹层编辑视图（行内/块级共用主体）
 *
 * 弹层编辑（与 CONTEXT.md「弹层编辑」词条一致，决策见 ADR-0005）：
 * - 文档内永远只显示渲染结果（katex-element 白名单管线），点击进入 NodeSelection；
 * - 选中后弹出跟随定位的浮层（MathEditPanel：源码输入 + 实时预览），
 *   Esc/点击外部关闭，关闭后光标移到公式之后。
 *
 * 浮层定位走 @floating-ui/dom absolute 策略（同浮动工具条）。浮层用 React Portal
 * 渲染到编辑器滚动容器内（非 body），offsetParent 清晰、受 overflow 裁剪——
 * 跟随公式滚动，滚出可视区即被裁剪，不覆盖页面/工具栏；下方空间不足时 flip 翻转。
 *
 * 开闭用独立 popoverOpen state，不直接绑定 Tiptap 的 selected prop：
 * selected 下降沿时 rAF 延迟确认 PM selection 确实不再选中此节点，跳过
 * handleSelectionUpdate rAF 竞态导致的短暂 deselectNode。
 *
 * 由 MathView 以 displayMode 适配出行内/块级两个 NodeView。
 */
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { renderKatexElement } from "@/shared/ui/katex";
import { useFloatingMathPanel } from "../hooks/useFloatingMathPanel";
import { updateMathLatex } from "../lib/update-math-latex";
import { MathEditPanel } from "./MathEditPanel";
import "katex/dist/katex.min.css";

export interface MathPopoverViewProps extends NodeViewProps {
	/** true=公式块（div + 多行输入），false=行内公式（span + 单行输入） */
	displayMode: boolean;
}

/** 从编辑器 DOM 向上找滚动容器（BubbleMenu 同款） */
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

export function MathPopoverView({
	node,
	selected,
	editor,
	getPos,
	displayMode,
}: MathPopoverViewProps) {
	const latex = node.attrs.latex as string;
	const rendered = useMemo(() => renderKatexElement(latex, displayMode), [latex, displayMode]);
	const pos = typeof getPos === "function" ? getPos() : null;

	const [popoverOpen, setPopoverOpen] = useState(false);

	useEffect(() => {
		if (selected) {
			// 只对锚在本节点的 NodeSelection 开窗。TipTap 的 selected 用区间覆盖
			// 判断（from <= pos && to >= pos + nodeSize），Ctrl+A 全选 / 拖选经过
			// 时所有公式 selected 同为 true，若据此开窗会 N 个弹窗齐开卡死页面。
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
		editor.chain().setNodeSelection(pos).deleteSelection().focus().run();
	};

	const changeLatex = (v: string) => {
		editor.commands.command(({ tr }) => {
			const p = typeof getPos === "function" ? getPos() : null;
			if (typeof p !== "number") return false;
			updateMathLatex(tr, p, v);
			return true;
		});
	};

	const anchorRef = useRef<HTMLDivElement | HTMLSpanElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	// 滚动容器：浮层 Portal 目标，也是 floating-ui 的定位边界
	const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setScrollContainer(findScrollContainer(editor.view.dom));
	}, [editor]);

	const position = useFloatingMathPanel(popoverOpen, anchorRef, panelRef, editor);

	// 点击外部 / Esc 关闭
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
						<MathEditPanel
							latex={latex}
							displayMode={displayMode}
							onDelete={handleDelete}
							onChange={changeLatex}
							onClose={close}
						/>
					</div>,
					scrollContainer,
				)
			: null;

	return (
		<NodeViewWrapper
			ref={anchorRef}
			as={displayMode ? "div" : "span"}
			data-type={displayMode ? "block-math" : "inline-math"}
			className={
				displayMode
					? `math-node-view math-node-view--block${selected ? " math-node-view--selected" : ""}`
					: `math-node-view${selected ? " math-node-view--selected" : ""}`
			}
			onClick={() => {
				if (typeof pos === "number") editor.chain().setNodeSelection(pos).run();
			}}
		>
			{rendered}
			{panel}
		</NodeViewWrapper>
	);
}
