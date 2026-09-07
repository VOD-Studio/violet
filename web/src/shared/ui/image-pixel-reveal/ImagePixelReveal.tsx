import { cn } from "@shared/lib/utils";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import styles from "./ImagePixelReveal.module.css";

export type PixelRevealVariant = "random" | "ripple" | "diagonal" | "curtain";

type RevealStatus = "loading" | "revealing" | "handoff" | "revealed";

export interface ImagePixelRevealProps {
	src: string;
	alt?: string;
	variant?: PixelRevealVariant;
	/** 瓦片基准尺寸，默认 44px */
	tileSize?: number;
	/** 最大切片瓦片数上限，默认 64 */
	maxTiles?: number;
	/** 单个瓦片动画时长（秒），默认 0.32s */
	duration?: number;
	/** 延迟分散跨度（毫秒），默认 380ms */
	spreadMs?: number;
	/** 是否在鼠标 hover 时允许重新播放微像素解构特效 */
	replayOnHover?: boolean;
	className?: string;
	imgClassName?: string;
	loading?: "eager" | "lazy";
	onError?: () => void;
	onRevealed?: () => void;
	children?: ReactNode;
}

interface TileData {
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
	bgX: number;
	bgY: number;
	bgWidth: number;
	bgHeight: number;
	delayMs: number;
}

/** 返回可复现的离散随机值。 */
function hashRandom(index: number, total: number): number {
	const val = Math.sin((index + 1) * 127.1 + total * 311.7) * 43758.5453;
	return val - Math.floor(val);
}

/**
 * 将图片切成自适应网格，按指定次序展开后无缝交回原图。
 *
 * 支持自定义子组件、多种延迟分布与 Reduced Motion 降级。
 */
export function ImagePixelReveal({
	src,
	alt = "",
	variant = "random",
	tileSize = 44,
	maxTiles = 64,
	duration = 0.32,
	spreadMs = 380,
	replayOnHover = false,
	className = "",
	imgClassName = "",
	loading = "lazy",
	onError,
	onRevealed,
	children,
}: ImagePixelRevealProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const reduceMotion = useReducedMotion();
	const [status, setStatus] = useState<RevealStatus>("loading");
	const [tiles, setTiles] = useState<TileData[]>([]);
	const revealTokenRef = useRef(0);
	const completionTimerRef = useRef<number | null>(null);
	const handoffFrameRef = useRef<number | null>(null);

	const cancelScheduledCompletion = useCallback(() => {
		if (completionTimerRef.current !== null) {
			window.clearTimeout(completionTimerRef.current);
			completionTimerRef.current = null;
		}
		if (handoffFrameRef.current !== null) {
			window.cancelAnimationFrame(handoffFrameRef.current);
			handoffFrameRef.current = null;
		}
	}, []);

	const completeReveal = useCallback(
		(currentToken: number) => {
			if (revealTokenRef.current !== currentToken) return;

			setStatus("handoff");
			handoffFrameRef.current = window.requestAnimationFrame(() => {
				handoffFrameRef.current = window.requestAnimationFrame(() => {
					handoffFrameRef.current = null;
					if (revealTokenRef.current !== currentToken) return;

					setStatus("revealed");
					onRevealed?.();
				});
			});
		},
		[onRevealed],
	);

	const computeDelay = useCallback(
		(col: number, row: number, cols: number, rows: number, index: number, total: number) => {
			switch (variant) {
				case "ripple": {
					const centerCol = (cols - 1) / 2;
					const centerRow = (rows - 1) / 2;
					const maxDist = Math.hypot(centerCol, centerRow) || 1;
					const dist = Math.hypot(col - centerCol, row - centerRow);
					return Math.round((dist / maxDist) * spreadMs);
				}
				case "diagonal": {
					const maxSteps = cols - 1 + (rows - 1) || 1;
					const currentStep = col + row;
					return Math.round((currentStep / maxSteps) * spreadMs);
				}
				case "curtain": {
					return Math.round((row / Math.max(1, rows - 1)) * spreadMs);
				}
				default: {
					return Math.round(hashRandom(index, total) * spreadMs);
				}
			}
		},
		[variant, spreadMs],
	);

	const triggerReveal = useCallback(() => {
		cancelScheduledCompletion();
		const currentToken = ++revealTokenRef.current;

		if (reduceMotion) {
			setStatus("revealed");
			onRevealed?.();
			return;
		}

		const container = containerRef.current;
		if (!container) return;

		const { width, height } = container.getBoundingClientRect();
		if (!width || !height) {
			setStatus("revealed");
			onRevealed?.();
			return;
		}

		let effectiveTileSize = tileSize;
		let cols = Math.max(1, Math.ceil(width / effectiveTileSize));
		let rows = Math.max(1, Math.ceil(height / effectiveTileSize));

		while (cols * rows > maxTiles) {
			effectiveTileSize *= Math.sqrt((cols * rows) / maxTiles);
			cols = Math.max(1, Math.ceil(width / effectiveTileSize));
			rows = Math.max(1, Math.ceil(height / effectiveTileSize));
			if (cols * rows > maxTiles) {
				if (cols >= rows && cols > 1) cols -= 1;
				else if (rows > 1) rows -= 1;
				else break;
			}
		}

		const colWidth = width / cols;
		const rowHeight = height / rows;
		const total = cols * rows;

		// 瓦片背景需复现 object-cover 的缩放与居中裁切。
		const img = imgRef.current;
		const natW = img?.naturalWidth || width;
		const natH = img?.naturalHeight || height;
		const scale = Math.max(width / natW, height / natH);
		const bgW = natW * scale;
		const bgH = natH * scale;
		const offsetX = (width - bgW) / 2;
		const offsetY = (height - bgH) / 2;

		const nextTiles: TileData[] = [];
		for (let r = 0; r < rows; r += 1) {
			for (let c = 0; c < cols; c += 1) {
				const idx = r * cols + c;
				const tileX = c * colWidth;
				const tileY = r * rowHeight;
				const delay = computeDelay(c, r, cols, rows, idx, total);

				nextTiles.push({
					index: idx,
					x: tileX,
					y: tileY,
					width: colWidth,
					height: rowHeight,
					bgX: offsetX - tileX,
					bgY: offsetY - tileY,
					bgWidth: bgW,
					bgHeight: bgH,
					delayMs: delay,
				});
			}
		}

		setTiles(nextTiles);
		setStatus("revealing");

		// 先在完整瓦片层后放入原图，跨过一次实际绘制后再移除瓦片。
		const totalDurationMs = spreadMs + duration * 1000 + 60;
		completionTimerRef.current = window.setTimeout(() => {
			completionTimerRef.current = null;
			completeReveal(currentToken);
		}, totalDurationMs);
	}, [
		cancelScheduledCompletion,
		completeReveal,
		computeDelay,
		duration,
		maxTiles,
		onRevealed,
		reduceMotion,
		spreadMs,
		tileSize,
	]);

	useEffect(() => {
		revealTokenRef.current += 1;
		cancelScheduledCompletion();
		setStatus("loading");
		setTiles([]);
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) {
			triggerReveal();
		}
	}, [cancelScheduledCompletion, triggerReveal]);

	useEffect(
		() => () => {
			revealTokenRef.current += 1;
			cancelScheduledCompletion();
		},
		[cancelScheduledCompletion],
	);
	const handleMouseEnter = () => {
		if (replayOnHover && status === "revealed") {
			triggerReveal();
		}
	};

	const isContentVisible = status === "handoff" || status === "revealed";
	const isTileLayerVisible = (status === "revealing" || status === "handoff") && tiles.length > 0;

	return (
		<div
			ref={containerRef}
			onMouseEnter={handleMouseEnter}
			className={cn(styles.host, className)}
		>
			<div className={cn(styles.content, isContentVisible && styles.contentVisible)}>
				{children ? (
					children
				) : (
					<img
						ref={imgRef}
						src={src}
						alt={alt}
						loading={loading}
						onLoad={triggerReveal}
						onError={onError}
						className={cn(styles.image, imgClassName)}
					/>
				)}
			</div>

			{/* children 模式仍需真实图片提供尺寸与加载状态。 */}
			{children ? (
				<img
					ref={imgRef}
					src={src}
					alt=""
					aria-hidden="true"
					loading="eager"
					onLoad={triggerReveal}
					onError={onError}
					className={styles.probe}
				/>
			) : null}

			{isTileLayerVisible ? (
				<div aria-hidden="true" className={styles.tiles}>
					{tiles.map((tile) => (
						<span
							key={tile.index}
							className={styles.tile}
							style={{
								left: `${tile.x}px`,
								top: `${tile.y}px`,
								width: `${tile.width + 0.5}px`,
								height: `${tile.height + 0.5}px`,
								backgroundImage: `url(${JSON.stringify(src)})`,
								backgroundSize: `${tile.bgWidth}px ${tile.bgHeight}px`,
								backgroundPosition: `${tile.bgX}px ${tile.bgY}px`,
								animationDelay: `${tile.delayMs}ms`,
								animationDuration: `${duration}s`,
							}}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}
