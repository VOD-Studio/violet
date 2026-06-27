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
 * 渲染在表头单元格右侧，使用指针事件 + setPointerCapture
 * 保证拖出表头区域仍可连续调整。
 *
 * 性能优化：拖拽过程中通过 CSS 变量实时更新视觉效果，
 * 只在拖拽结束时才调用 onResize 持久化状态。
 */
export function ColumnResizer({
	width,
	minWidth,
	onResize,
}: ColumnResizerProps) {
	const startX = useRef(0);
	const startWidth = useRef(width);
	const dragging = useRef(false);
	const thElement = useRef<HTMLTableCellElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
		dragging.current = true;
		setIsDragging(true);
		startX.current = e.clientX;
		// 直接从 DOM 读真实渲染宽度，避免 prop 为 0 或与实际不符导致起始错位
		const th = e.currentTarget.closest("th");
		thElement.current = th;
		startWidth.current = th ? th.offsetWidth : width;
		e.currentTarget.setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();

		// 防止拖拽时选中文本
		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";
	};

	const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (!dragging.current || !thElement.current) return;
		const delta = e.clientX - startX.current;
		const next = Math.max(minWidth, Math.round(startWidth.current + delta));

		// 拖拽过程中只更新 th 元素的宽度，不触发 React 状态更新
		thElement.current.style.width = `${next}px`;

		// 同时更新 colgroup 中对应的 col 元素
		const colIndex = Array.from(
			thElement.current.parentElement?.children || [],
		).indexOf(thElement.current);
		const table = thElement.current.closest("table");
		const col = table?.querySelector(`colgroup col:nth-child(${colIndex + 1})`);
		if (col instanceof HTMLElement) {
			col.style.width = `${next}px`;
		}
	};

	const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (!dragging.current) return;

		dragging.current = false;
		setIsDragging(false);

		// 恢复 body 样式
		document.body.style.userSelect = "";
		document.body.style.cursor = "";

		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			/* 指针已释放 */
		}

		// 只在拖拽结束时调用 onResize 持久化
		if (thElement.current) {
			const finalWidth = thElement.current.offsetWidth;
			onResize(finalWidth);
		}

		thElement.current = null;
	};

	// 处理指针离开按钮区域的情况
	const onPointerLeave = () => {
		// 如果正在拖拽，不重置状态（因为我们使用了 setPointerCapture）
		// 如果没有拖拽，确保重置 isDragging 状态
		if (!dragging.current && isDragging) {
			setIsDragging(false);
		}
	};

	return (
		<button
			type="button"
			aria-label="调整列宽"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onPointerLeave={onPointerLeave}
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
				"after:absolute after:inset-y-0 after:right-[-6px] after:w-[18px]",
				// 悬停和激活状态
				isDragging
					? "bg-primary/60"
					: "hover:bg-primary/40 focus-visible:bg-primary/60 active:bg-primary/60",
			)}
		/>
	);
}
