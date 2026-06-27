import { useRef } from "react";
import { cn } from "@/shared/lib/utils";

interface ColumnResizerProps {
	/** 当前列宽（px），拖拽起点 */
	width: number;
	/** 最小宽度，拖拽下限 */
	minWidth: number;
	/** 拖拽完成时回调新宽度 */
	onResize: (width: number) => void;
}

/**
 * ColumnResizer - 列宽拖拽手柄
 *
 * 渲染在表头单元格右侧，使用指针事件 + setPointerCapture
 * 保证拖出表头区域仍可连续调整。
 */
export function ColumnResizer({ width, minWidth, onResize }: ColumnResizerProps) {
	const startX = useRef(0);
	const startWidth = useRef(width);
	const dragging = useRef(false);

	function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
		dragging.current = true;
		startX.current = e.clientX;
		startWidth.current = width;
		e.currentTarget.setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
		if (!dragging.current) return;
		const delta = e.clientX - startX.current;
		const next = Math.max(minWidth, Math.round(startWidth.current + delta));
		onResize(next);
	}

	function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
		dragging.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			/* 指针已释放 */
		}
	}

	return (
		<button
			type="button"
			aria-label="调整列宽"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") onResize(Math.max(minWidth, width - 8));
				else if (e.key === "ArrowRight") onResize(width + 8);
				else return;
				e.stopPropagation();
			}}
			className={cn(
				"absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none border-0 bg-transparent p-0",
				"hover:bg-primary/40 focus-visible:bg-primary/60 active:bg-primary/60",
				"before:absolute before:inset-y-2 before:right-0 before:w-px before:bg-border",
			)}
		/>
	);
}
