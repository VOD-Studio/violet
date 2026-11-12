"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

/** 键盘每次按 ←/→ 调整的宽度 */
const KEY_STEP = 8;

interface ColumnResizerProps {
	/** 最小宽度，拖拽与键盘调整的下限 */
	minWidth: number;
	/** 调整后的宽度；拖拽中写的 DOM 在回调前已还原，由调用方的状态重新渲染 */
	onResize: (width: number) => void;
}

/** 表头单元格内的列宽拖拽手柄；方向键 ←/→ 每次调整 8px。 */
export function ColumnResizer({ minWidth, onResize }: ColumnResizerProps) {
	const [dragging, setDragging] = useState(false);
	const active = useRef(false);

	const columnWidths = (th: HTMLTableCellElement) =>
		Array.from(th.parentElement?.children ?? [], (cell) => cell.getBoundingClientRect().width);

	const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		const th = event.currentTarget.closest("th");
		const table = th?.closest("table");
		if (!th || !table) return;
		const widths = columnWidths(th);
		const columnIndex = Array.from(th.parentElement?.children ?? []).indexOf(th);
		const startWidth = widths[columnIndex];
		const startX = event.clientX;
		let lastWidth = startWidth;
		const original = {
			minWidth: table.style.minWidth,
			width: table.style.width,
			widths: Array.from(
				table.querySelectorAll<HTMLElement>("colgroup col"),
				(col) => col.style.width,
			),
		};

		// 拖拽产生位移前不写 DOM，单击手柄不会固化自适应列宽；
		// 表宽同时钉成各列之和，多余宽度没处可分，窄列与固定列不会在拖拽中被撑宽
		const applyWidths = (next: number) => {
			const total = widths.reduce(
				(sum, width, index) => sum + (index === columnIndex ? next : width),
				0,
			);
			table.querySelectorAll<HTMLElement>("colgroup col").forEach((col, index) => {
				col.style.width = `${index === columnIndex ? next : widths[index]}px`;
			});
			table.style.minWidth = `${total}px`;
			table.style.width = `${total}px`;
		};

		active.current = true;
		setDragging(true);
		event.stopPropagation();
		event.preventDefault();
		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";

		const onMove = (move: globalThis.PointerEvent) => {
			if (!active.current) return;
			const next = Math.max(minWidth, Math.round(startWidth + move.clientX - startX));
			if (next === lastWidth) return;
			lastWidth = next;
			applyWidths(next);
		};

		const onEnd = (end: globalThis.PointerEvent) => {
			if (!active.current) return;
			active.current = false;
			setDragging(false);
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onEnd);
			document.removeEventListener("pointercancel", onEnd);

			// 拖拽期间手写的 colgroup 与最小宽度先还原：不在状态里的列（如伸缩列）否则会残留手写值
			table.style.minWidth = original.minWidth;
			table.style.width = original.width;
			table.querySelectorAll<HTMLElement>("colgroup col").forEach((col, index) => {
				col.style.width = original.widths[index];
			});
			if (end.type === "pointerup" && lastWidth !== startWidth) onResize(lastWidth);
		};

		// 用 document 监听：拖出表头后仍能连续调整，也不依赖指针捕获
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onEnd);
		document.addEventListener("pointercancel", onEnd);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		const th = event.currentTarget.closest("th");
		if (!th) return;
		const widths = columnWidths(th);
		const index = Array.from(th.parentElement?.children ?? []).indexOf(th);
		const delta = event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP;
		onResize(Math.max(minWidth, widths[index] + delta));
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<button
			type="button"
			aria-label="调整列宽"
			className="v-table__resizer"
			data-dragging={dragging ? "" : undefined}
			onPointerDown={onPointerDown}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={onKeyDown}
		/>
	);
}
