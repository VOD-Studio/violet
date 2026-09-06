import { useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

export type PixelRevealVariant = "random" | "ripple" | "diagonal" | "curtain";

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

/** 伪随机哈希散列函数（保证离散随机分布且确定性可复现） */
function hashRandom(index: number, total: number): number {
	const val = Math.sin((index + 1) * 127.1 + total * 311.7) * 43758.5453;
	return val - Math.floor(val);
}

/**
 * ImagePixelReveal: 像素切片矩阵解构展开动效组件
 *
 * 将图片在加载完成后切分成自适应的网格切片，按指定变体（random / ripple / diagonal / curtain）
 * 错落缩放淡入，随后无缝交接给原图。支持自定义子组件、多变体与 Reduced Motion 降级。
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
	const [status, setStatus] = useState<"loading" | "revealing" | "revealed">("loading");
	const [tiles, setTiles] = useState<TileData[]>([]);
	const revealTokenRef = useRef(0);

	// 根据变体计算单个瓦片的延迟毫秒数
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

	// 触发生成瓦片切片并执行展开动画
	const triggerReveal = useCallback(() => {
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

		// 计算行列数并钳制在 maxTiles 以内
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

		// 计算背景居中等比覆盖尺寸与偏移
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

		const currentToken = ++revealTokenRef.current;
		setTiles(nextTiles);
		setStatus("revealing");

		// 监听最大动画时间完成后落定
		const totalDurationMs = spreadMs + duration * 1000 + 60;
		window.setTimeout(() => {
			if (revealTokenRef.current === currentToken) {
				setStatus("revealed");
				onRevealed?.();
			}
		}, totalDurationMs);
	}, [reduceMotion, tileSize, maxTiles, spreadMs, duration, computeDelay, onRevealed]);

	// 监听 src 切换重置状态
	useEffect(() => {
		setStatus("loading");
		setTiles([]);
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) {
			triggerReveal();
		}
	}, [triggerReveal]);

	// Hover 重播支持
	const handleMouseEnter = () => {
		if (replayOnHover && status === "revealed") {
			triggerReveal();
		}
	};

	return (
		<div
			ref={containerRef}
			onMouseEnter={handleMouseEnter}
			className={`image-pixel-reveal-host relative isolate overflow-hidden ${className}`}
		>
			{/* 底层真实原图或子组件 */}
			<div
				className={`size-full transition-opacity duration-300 ${
					status === "revealed" ? "opacity-100" : "opacity-0"
				}`}
			>
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
						className={`size-full object-cover ${imgClassName}`}
					/>
				)}
			</div>

			{/* 隐藏的探测图片（用于测量 naturalWidth/Height 与 onLoad 事件） */}
			{children ? (
				<img
					ref={imgRef}
					src={src}
					alt=""
					aria-hidden="true"
					loading="eager"
					onLoad={triggerReveal}
					onError={onError}
					className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0"
				/>
			) : null}

			{/* 瓦片切片动画层 */}
			{status === "revealing" && tiles.length > 0 ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
				>
					{tiles.map((tile) => (
						<span
							key={tile.index}
							className="image-pixel-reveal__tile"
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
