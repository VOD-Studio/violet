import { useEffect, useRef } from "react";

import { drawPaperSurface } from "./draw-paper-surface";

/** 仅在尺寸、像素密度或主题变化时重绘的装饰纸面。 */
export function PaperSurface() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		let previousWidth = 0;
		let previousHeight = 0;
		let previousRatio = 0;
		let previousColor = "";
		let resolution: MediaQueryList | undefined;

		const paint = () => {
			// clientWidth 不包含弹窗开合的 scale，避免动效期间重采样纸边。
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			if (!width || !height) return;
			const ratio = Math.min(3, Math.max(2, window.devicePixelRatio));
			const color = getComputedStyle(canvas).color;
			if (
				width === previousWidth &&
				height === previousHeight &&
				ratio === previousRatio &&
				color === previousColor
			)
				return;
			canvas.width = Math.ceil(width * ratio);
			canvas.height = Math.ceil(height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			drawPaperSurface(context, width, height, color);
			previousWidth = width;
			previousHeight = height;
			previousRatio = ratio;
			previousColor = color;
		};
		const watchResolution = () => {
			resolution?.removeEventListener("change", watchResolution);
			resolution = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			resolution.addEventListener("change", watchResolution);
			paint();
		};
		const resizeObserver = new ResizeObserver(paint);
		resizeObserver.observe(canvas);
		const themeObserver = new MutationObserver(paint);
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		watchResolution();
		return () => {
			resizeObserver.disconnect();
			themeObserver.disconnect();
			resolution?.removeEventListener("change", watchResolution);
		};
	}, []);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 drop-shadow-[0_8px_14px_rgba(0,0,0,0.16)] dark:drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
		>
			<div className="absolute inset-3 bg-card" />
			<canvas ref={canvasRef} className="absolute inset-0 size-full text-card" />
		</div>
	);
}
