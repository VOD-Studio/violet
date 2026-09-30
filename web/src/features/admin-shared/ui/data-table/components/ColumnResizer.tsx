import { cn } from "cn";
import { useRef, useState } from "react";

interface ColumnResizerProps {
	/** 最小宽度，拖拽下限 */
	minWidth: number;
	/** 拖拽结果与拖拽前全部可见列的真实宽度，用于锁定相邻列 */
	onResize: (width: number, widths: number[]) => void;
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
export function ColumnResizer({ minWidth, onResize }: ColumnResizerProps) {
	const startX = useRef(0);
	const startWidth = useRef(0);
	const dragging = useRef(false);
	const lastWidth = useRef(0);
	const [isDragging, setIsDragging] = useState(false);

	const getColumnWidths = (th: HTMLTableCellElement) =>
		Array.from(th.parentElement?.children ?? [], (cell) => cell.getBoundingClientRect().width);

	const getTables = (th: HTMLTableCellElement) => {
		const headerTable = th.closest("table");
		const bodyTable = headerTable?.parentElement?.parentElement?.querySelector(
			":scope > div > div > table",
		);
		return [headerTable, bodyTable].filter(
			(table): table is HTMLTableElement => table instanceof HTMLTableElement,
		);
	};

	const updateColumnWidths = (
		tables: HTMLTableElement[],
		widths: number[],
		columnIndex: number,
		newWidth: number,
	) => {
		const total = widths.reduce(
			(sum, width, index) => sum + (index === columnIndex ? newWidth : width),
			0,
		);
		for (const table of tables) {
			const cols = table.querySelectorAll("colgroup col");
			cols.forEach((col, index) => {
				if (col instanceof HTMLElement) {
					col.style.width = `${index === columnIndex ? newWidth : widths[index]}px`;
				}
			});
			table.style.minWidth = `${total}px`;
		}
	};

	const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
		const th = e.currentTarget.closest("th");
		if (!th) return;
		const widths = getColumnWidths(th);
		const columnIndex = Array.from(th.parentElement?.children ?? []).indexOf(th);
		const tables = getTables(th);
		const originalStyles = tables.map((table) => ({
			minWidth: table.style.minWidth,
			widths: Array.from(
				table.querySelectorAll("colgroup col"),
				(col) => (col as HTMLElement).style.width,
			),
		}));

		dragging.current = true;
		setIsDragging(true);
		startX.current = e.clientX;
		// 直接从 DOM 读真实渲染宽度，避免 prop 为 0 或与实际不符导致起始错位
		startWidth.current = widths[columnIndex];
		lastWidth.current = startWidth.current;
		// 拖拽产生实际位移后才写 DOM；单击手柄不能固化自适应列宽。
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
			if (next === lastWidth.current) return;
			lastWidth.current = next;
			updateColumnWidths(tables, widths, columnIndex, next);
		};

		const onDocumentPointerUp = (event: PointerEvent) => {
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

			if (event.type === "pointerup" && lastWidth.current !== startWidth.current) {
				onResize(lastWidth.current, widths);
			} else {
				tables.forEach((table, tableIndex) => {
					table.style.minWidth = originalStyles[tableIndex].minWidth;
					table.querySelectorAll("colgroup col").forEach((col, index) => {
						(col as HTMLElement).style.width = originalStyles[tableIndex].widths[index];
					});
				});
			}
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
				if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
				const th = e.currentTarget.closest("th");
				if (!th) return;
				const widths = getColumnWidths(th);
				const index = Array.from(th.parentElement?.children ?? []).indexOf(th);
				onResize(
					Math.max(minWidth, widths[index] + (e.key === "ArrowLeft" ? -8 : 8)),
					widths,
				);
				e.preventDefault();
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
