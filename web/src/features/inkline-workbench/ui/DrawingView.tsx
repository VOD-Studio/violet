import type { Drawing, Palette } from "@violetjs/inkline";
import { mountSvg, updateSvgPalette } from "@violetjs/inkline/svg";
import { cn } from "cn";
import { useEffect, useRef } from "react";

export interface DrawingViewProps {
	drawing: Drawing;
	palette: Palette;
	/** 画面的无障碍名称，写入 SVG 的 title */
	label: string;
	className?: string;
}

/**
 * 挂载一份生成结果并按容器等比缩放；只换配色时用 updateSvgPalette，不重新挂载。
 */
export function DrawingView({ drawing, palette, label, className }: DrawingViewProps) {
	const host = useRef<HTMLDivElement>(null);
	const svg = useRef<SVGSVGElement | null>(null);
	const latestPalette = useRef(palette);
	latestPalette.current = palette;

	useEffect(() => {
		const element = mountSvg(drawing, latestPalette.current, { title: label });
		// mountSvg 写了行内 width:100%;height:auto，这里要按容器的宽高同时约束
		element.removeAttribute("style");
		element.setAttribute("class", "block size-full");
		host.current?.replaceChildren(element);
		svg.current = element;
		return () => {
			element.remove();
			svg.current = null;
		};
	}, [drawing, label]);

	useEffect(() => {
		if (svg.current) updateSvgPalette(svg.current, palette);
	}, [palette]);

	return <div ref={host} className={cn("min-h-0 min-w-0", className)} />;
}
