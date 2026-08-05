import { useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

interface ColumnResizerProps {
	/** 当前列宽（px），拖拽起点 */
	width: number;
	/** 最小宽度，拖拽下限 */
	minWidth: number;
	/** 拖拽完成时回调新宽度（只在拖拽结束时调用） */
	onResize: (width: number) => void;
}

/**
 * ColumnResizer - 列宽拖拽手柄
 *
 * 渲染在表头单元格右侧，使用 document 级别的 pointermove/pointerup 监听
 * 保证拖出表头区域仍可连续调整，且避免 React 合成事件丢失问题。
 *
 * 拖拽过程中同时更新 header table 和 body table 的 colgroup col 宽度，
 * 实现实时视觉同步。只在拖拽结束时才调用 onResize 持久化状态。
 */
export function ColumnResizer({ width, minWidth, onResize }: ColumnResizerProps) {
	const startX = useRef(0);
	const startWidth = useRef(width);
	const dragging = useRef(false);
	const lastWidth = useRef(width);
	const [isDragging, setIsDragging] = useState(false);

	/**
	 * 根据 th 元素找到其在 header table 和 body table 中对应的 colgroup col，
	 * 同时更新两者宽度，实现拖拽过程中 header/body 实时同步。
	 */
	const updateColumnWidths = (th: HTMLTableCellElement, newWidth: number) => {
		const colIndex = Array.from(th.parentElement?.children || []).indexOf(th);
		// th → table → headerScrollDiv → wrapper（包含 header 和 body 两个 table 的根容器）
		const headerTable = th.closest("table");
		const wrapper = headerTable?.parentElement?.parentElement;
		if (!wrapper) return;

		const tables = wrapper.querySelectorAll("table");
		for (const table of tables) {
			const col = table.querySelector(`colgroup col:nth-child(${colIndex + 1})`);
			if (col instanceof HTMLElement) {
				col.style.width = `${newWidth}px`;
			}
		}

		// 同时更新 th 本身，保证 header 单元格宽度与 col 一致
		th.style.width = `${newWidth}px`;
	};

	const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
		const th = e.currentTarget.closest("th");
		if (!th) return;

		dragging.current = true;
		setIsDragging(true);
		startX.current = e.clientX;
		// 直接从 DOM 读真实渲染宽度，避免 prop 为 0 或与实际不符导致起始错位
		startWidth.current = th.offsetWidth;
		lastWidth.current = th.offsetWidth;
		e.stopPropagation();
		e.preventDefault();

		// 防止拖拽时选中文本
		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";

		// 使用 document 级别的事件监听器，避免 React 合成事件的 pointer capture 丢失问题
		const onDocumentPointerMove = (moveEvent: PointerEvent) => {
			if (!dragging.current) return;
			const delta = moveEvent.clientX - startX.current;
			const next = Math.max(minWidth, Math.round(startWidth.current + delta));
			lastWidth.current = next;
			updateColumnWidths(th, next);
		};

		const onDocumentPointerUp = () => {
			if (!dragging.current) return;

			dragging.current = false;
			setIsDragging(false);

			// 恢复 body 样式
			document.body.style.userSelect = "";
			document.body.style.cursor = "";

			// 移除 document 级别监听器
			document.removeEventListener("pointermove", onDocumentPointerMove);
			document.removeEventListener("pointerup", onDocumentPointerUp);
			document.removeEventListener("pointercancel", onDocumentPointerUp);

			// 只在拖拽结束时调用 onResize 持久化
			onResize(lastWidth.current);
		};

		document.addEventListener("pointermove", onDocumentPointerMove);
		document.addEventListener("pointerup", onDocumentPointerUp);
		document.addEventListener("pointercancel", onDocumentPointerUp);
	};

	return (
		<button
			type="button"
			aria-label="调整列宽"
			onPointerDown={onPointerDown}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") onResize(Math.max(minWidth, width - 8));
				else if (e.key === "ArrowRight") onResize(width + 8);
				else return;
				e.stopPropagation();
			}}
			className={cn(
				"absolute top-0 right-0 z-10 h-full touch-none border-0 bg-transparent p-0",
				// 扩大命中区域：手柄本身 6px + 左右各 6px 透明区域
				"w-1.5 cursor-col-resize",
				"before:absolute before:inset-y-2 before:right-0 before:w-px before:bg-border",
				// 使用伪元素扩大可点击区域
				"after:absolute after:inset-y-0 after:-right-1.5 after:w-4.5",
				// 悬停和激活状态
				isDragging
					? "bg-primary/60"
					: "hover:bg-primary/40 focus-visible:bg-primary/60 active:bg-primary/60",
			)}
		/>
	);
}
