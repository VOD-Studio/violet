import { cn } from "cn";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Size } from "./lib/crop-display";
import {
	type FrameView,
	MAX_ZOOM,
	MIN_ZOOM,
	panView,
	viewToRect,
	zoomView,
} from "./lib/frame-view";
import type { CropRect } from "./types";

export interface ImageFramerProps {
	/** 图片源（object URL 或远程 URL） */
	src: string;
	/** 取景框宽高比（宽 ÷ 高） */
	aspect: number;
	/** 圆形取景（头像）：框外压暗，选区仍是外接矩形 */
	round?: boolean;
	/** 视野变化回调（归一化坐标 0~1）；图片加载后立即回传初始视野 */
	onChange: (rect: CropRect) => void;
	/** 图片加载完成，给出原图像素尺寸 */
	onImageSize?: (size: Size) => void;
}

const KEY_STEP = 0.02;

/**
 * ImageFramer - 固定取景框、图片可拖动与缩放的取景交互。
 *
 * 取景框比例固定，用户拖动图片调整位置，滚轮、滑块或 +/- 键缩放，方向键微调；
 * 图片始终铺满取景框，不会露出空白。输出与 ImageCropper 相同的归一化选区。
 */
export function ImageFramer({ src, aspect, round, onChange, onImageSize }: ImageFramerProps) {
	const frameRef = useRef<HTMLDivElement>(null);
	const [natural, setNatural] = useState<Size | null>(null);
	const [view, setView] = useState<FrameView>({ cx: 0.5, cy: 0.5, zoom: 1 });
	const [dragging, setDragging] = useState(false);
	const drag = useRef<{ x: number; y: number; view: FrameView } | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const rect = natural ? viewToRect(view, natural, aspect) : null;

	// 换图或换比例：回到初始视野
	// biome-ignore lint/correctness/useExhaustiveDependencies: src/aspect 是重置触发器
	useEffect(() => {
		setNatural(null);
		setView({ cx: 0.5, cy: 0.5, zoom: 1 });
	}, [src, aspect]);

	const emit = useCallback(
		(next: FrameView, size: Size) => {
			setView(next);
			onChangeRef.current(viewToRect(next, size, aspect));
		},
		[aspect],
	);

	const frameSize = (): Size => {
		const box = frameRef.current?.getBoundingClientRect();
		return { w: box?.width || 1, h: box?.height || 1 };
	};

	// 滚轮缩放需要 preventDefault，React 的 onWheel 是被动监听
	useEffect(() => {
		const el = frameRef.current;
		if (!el || !natural) return;
		const handler = (event: WheelEvent) => {
			event.preventDefault();
			const box = el.getBoundingClientRect();
			const anchor = {
				x: (event.clientX - box.left) / (box.width || 1),
				y: (event.clientY - box.top) / (box.height || 1),
			};
			emit(
				zoomView(
					view,
					natural,
					aspect,
					view.zoom * Math.exp(-event.deltaY * 0.002),
					anchor,
				),
				natural,
			);
		};
		el.addEventListener("wheel", handler, { passive: false });
		return () => el.removeEventListener("wheel", handler);
	}, [aspect, emit, natural, view]);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (!natural || !rect) return;
		const frame = { w: 1, h: 1 };
		const step = (dx: number, dy: number) => {
			event.preventDefault();
			emit(panView(view, natural, aspect, { x: dx, y: dy }, frame), natural);
		};
		switch (event.key) {
			case "ArrowLeft":
				return step(-KEY_STEP / rect.w, 0);
			case "ArrowRight":
				return step(KEY_STEP / rect.w, 0);
			case "ArrowUp":
				return step(0, -KEY_STEP / rect.h);
			case "ArrowDown":
				return step(0, KEY_STEP / rect.h);
			case "+":
			case "=":
				event.preventDefault();
				return emit(zoomView(view, natural, aspect, view.zoom * 1.1), natural);
			case "-":
				event.preventDefault();
				return emit(zoomView(view, natural, aspect, view.zoom / 1.1), natural);
		}
	};

	return (
		<div className="flex flex-col items-center gap-3">
			<div
				ref={frameRef}
				role="slider"
				aria-label="取景框：拖动图片调整位置，方向键微调，+/- 缩放"
				aria-valuemin={MIN_ZOOM}
				aria-valuemax={MAX_ZOOM}
				aria-valuenow={Number(view.zoom.toFixed(2))}
				aria-valuetext={`缩放 ${Math.round(view.zoom * 100)}%`}
				tabIndex={0}
				onKeyDown={handleKeyDown}
				onPointerDown={(event) => {
					if (!natural || event.button !== 0) return;
					event.currentTarget.setPointerCapture(event.pointerId);
					drag.current = { x: event.clientX, y: event.clientY, view };
					setDragging(true);
				}}
				onPointerMove={(event) => {
					if (!drag.current || !natural) return;
					const start = drag.current;
					emit(
						panView(
							start.view,
							natural,
							aspect,
							{ x: event.clientX - start.x, y: event.clientY - start.y },
							frameSize(),
						),
						natural,
					);
				}}
				onPointerUp={() => {
					drag.current = null;
					setDragging(false);
				}}
				onPointerCancel={() => {
					drag.current = null;
					setDragging(false);
				}}
				className={cn(
					"relative max-w-full touch-none overflow-hidden rounded-lg bg-muted select-none",
					"outline-none focus-visible:ring-2 focus-visible:ring-ring",
					dragging ? "cursor-grabbing" : "cursor-grab",
				)}
				style={{ aspectRatio: aspect, width: `min(100%, ${(aspect * 46).toFixed(2)}vh)` }}
			>
				<img
					src={src}
					alt="待裁剪"
					draggable={false}
					crossOrigin="anonymous"
					onLoad={(event) => {
						const size = {
							w: event.currentTarget.naturalWidth,
							h: event.currentTarget.naturalHeight,
						};
						setNatural(size);
						onImageSize?.(size);
						onChangeRef.current(
							viewToRect({ cx: 0.5, cy: 0.5, zoom: 1 }, size, aspect),
						);
					}}
					className={cn("absolute max-w-none", !rect && "invisible")}
					style={
						rect
							? {
									width: `${100 / rect.w}%`,
									height: `${100 / rect.h}%`,
									left: `${(-rect.x / rect.w) * 100}%`,
									top: `${(-rect.y / rect.h) * 100}%`,
								}
							: { width: "100%", height: "100%" }
					}
				/>
				{round ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 ring-1 ring-white/60 ring-inset"
						style={{
							background:
								"radial-gradient(circle closest-side, transparent calc(100% - 1px), rgb(0 0 0 / 0.5) 100%)",
						}}
					/>
				) : (
					<div
						aria-hidden="true"
						className={cn(
							"pointer-events-none absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none",
							dragging ? "opacity-100" : "opacity-0",
						)}
						style={{
							backgroundImage:
								"linear-gradient(to right, transparent calc(33.333% - 0.5px), rgb(255 255 255 / 0.6) calc(33.333% - 0.5px), rgb(255 255 255 / 0.6) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgb(255 255 255 / 0.6) calc(66.666% - 0.5px), rgb(255 255 255 / 0.6) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)), linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgb(255 255 255 / 0.6) calc(33.333% - 0.5px), rgb(255 255 255 / 0.6) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgb(255 255 255 / 0.6) calc(66.666% - 0.5px), rgb(255 255 255 / 0.6) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))",
						}}
					/>
				)}
			</div>
			<div className="flex w-full max-w-sm items-center gap-2 text-muted-foreground">
				<ZoomOut className="size-4 shrink-0" aria-hidden="true" />
				<input
					type="range"
					aria-label="缩放"
					min={MIN_ZOOM}
					max={MAX_ZOOM}
					step={0.01}
					value={view.zoom}
					disabled={!natural}
					onChange={(event) => {
						if (natural)
							emit(
								zoomView(view, natural, aspect, Number(event.target.value)),
								natural,
							);
					}}
					className="h-1 flex-1 accent-primary"
				/>
				<ZoomIn className="size-4 shrink-0" aria-hidden="true" />
			</div>
			<p className="text-xs text-muted-foreground">拖动图片调整位置，滚轮或滑块缩放</p>
		</div>
	);
}
