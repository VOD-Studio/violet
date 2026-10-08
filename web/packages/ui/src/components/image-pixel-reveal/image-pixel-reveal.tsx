"use client";

import { cn } from "cn";
import {
	type ComponentProps,
	type CSSProperties,
	type MouseEvent,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

export type PixelRevealVariant = "random" | "ripple" | "diagonal" | "curtain";

type RevealStatus = "loading" | "revealing" | "revealed";

/**
 * 原生 div 属性与 ref 属于根容器；imgClassName 控制原图裁剪，children 替代显示内容。
 */
export interface ImagePixelRevealProps extends Omit<ComponentProps<"div">, "onError"> {
	src: string;
	alt?: string;
	variant?: PixelRevealVariant;
	/**
	 * 网格基准尺寸（px）。
	 * @default 44
	 */
	tileSize?: number;
	/**
	 * 图片瓦片数量上限。
	 * @default 64
	 */
	maxTiles?: number;
	/**
	 * 单格裁剪展开时长（秒）。
	 * @default 0.32
	 */
	duration?: number;
	/**
	 * 揭示次序的延迟跨度（毫秒）。
	 * @default 380
	 */
	spreadMs?: number;
	/** 悬停时重新播放瓦片展开。 */
	replayOnHover?: boolean;
	imgClassName?: string;
	loading?: "eager" | "lazy";
	onError?: () => void;
	/** 每次揭示或悬停重播完成后调用一次；减弱动态时在加载完成后直接调用。 */
	onRevealed?: () => void;
}

interface TileData {
	index: number;
	delayMs: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface RevealGrid {
	id: number;
	tiles: TileData[];
	lastTileIndex: number;
}

let reducedMotionQuery: MediaQueryList | undefined;

function getReducedMotionQuery() {
	reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
	return reducedMotionQuery;
}

function subscribeReducedMotion(onChange: () => void) {
	const query = getReducedMotionQuery();
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

const getReducedMotionSnapshot = () => getReducedMotionQuery().matches;
const getServerReducedMotionSnapshot = () => false;

/**
 * 保持同一张原图静止，通过瓦片裁剪展开逐块拼合；random 每轮重新洗牌。
 *
 * 减弱动态时直接显示；更换 src 会开始独立的加载与揭示周期。
 */
export function ImagePixelReveal(props: ImagePixelRevealProps) {
	return <PixelRevealImage key={props.src} {...props} />;
}

function PixelRevealImage({
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
	ref,
	onMouseEnter,
	...props
}: ImagePixelRevealProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const maskId = useId();
	const maskStyle = useMemo<CSSProperties>(
		() => ({ maskImage: `url("#${maskId}")`, maskMode: "alpha" }),
		[maskId],
	);
	const reduceMotion = useSyncExternalStore(
		subscribeReducedMotion,
		getReducedMotionSnapshot,
		getServerReducedMotionSnapshot,
	);
	const [status, setStatus] = useState<RevealStatus>("loading");
	const [grid, setGrid] = useState<RevealGrid | null>(null);
	const revealIdRef = useRef(0);
	const startedRef = useRef(false);

	useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
		ref,
		() => containerRef.current,
		[],
	);

	const completeReveal = useCallback(
		(id: number) => {
			if (revealIdRef.current !== id) return;
			revealIdRef.current += 1;
			setStatus("revealed");
			setGrid(null);
			onRevealed?.();
		},
		[onRevealed],
	);

	const computeDelay = useCallback(
		(col: number, row: number, cols: number, rows: number) => {
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
					return Math.round(((col + row) / maxSteps) * spreadMs);
				}
				case "curtain":
					return Math.round((row / Math.max(1, rows - 1)) * spreadMs);
				default:
					return 0;
			}
		},
		[variant, spreadMs],
	);

	const triggerReveal = useCallback(
		(replay = false) => {
			if (!replay && startedRef.current) return;
			const content = contentRef.current;
			if (!content) return;
			startedRef.current = true;
			const id = ++revealIdRef.current;
			const { width, height } = content.getBoundingClientRect();
			if (reduceMotion || !width || !height) {
				completeReveal(id);
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

			const total = cols * rows;
			const tiles: TileData[] = [];
			const overlapX = 1 / width;
			const overlapY = 1 / height;
			const maskTileWidth = 1 / cols + overlapX * 2;
			const maskTileHeight = 1 / rows + overlapY * 2;
			const randomStep = variant === "random" ? spreadMs / Math.max(1, total - 1) : 0;
			let lastTileIndex = 0;
			let lastDelay = -1;
			for (let row = 0; row < rows; row += 1) {
				for (let col = 0; col < cols; col += 1) {
					const index = row * cols + col;
					const delayMs =
						variant === "random"
							? Math.round(index * randomStep)
							: computeDelay(col, row, cols, rows);
					tiles.push({
						index,
						delayMs,
						x: col / cols - overlapX,
						y: row / rows - overlapY,
						width: maskTileWidth,
						height: maskTileHeight,
					});
					if (delayMs >= lastDelay) {
						lastDelay = delayMs;
						lastTileIndex = index;
					}
				}
			}

			if (variant === "random") {
				for (let index = total - 1; index > 0; index -= 1) {
					const otherIndex = Math.floor(Math.random() * (index + 1));
					const delay = tiles[index].delayMs;
					tiles[index].delayMs = tiles[otherIndex].delayMs;
					tiles[otherIndex].delayMs = delay;
					if (lastTileIndex === index) lastTileIndex = otherIndex;
					else if (lastTileIndex === otherIndex) lastTileIndex = index;
				}
			}

			setGrid({ id, tiles, lastTileIndex });
			setStatus("revealing");
		},
		[completeReveal, computeDelay, maxTiles, reduceMotion, spreadMs, tileSize, variant],
	);

	useEffect(() => {
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) {
			triggerReveal();
		}
	}, [triggerReveal]);

	useEffect(() => {
		if (reduceMotion && status === "revealing") {
			completeReveal(revealIdRef.current);
		}
	}, [completeReveal, reduceMotion, status]);

	const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
		onMouseEnter?.(event);
		if (!event.defaultPrevented && replayOnHover && !reduceMotion && status === "revealed") {
			triggerReveal(true);
		}
	};

	return (
		<div
			{...props}
			ref={containerRef}
			onMouseEnter={handleMouseEnter}
			data-state={status}
			className={cn("v-image-pixel-reveal", className)}
		>
			<div ref={contentRef} className="v-image-pixel-reveal__content" style={maskStyle}>
				{children ? (
					children
				) : (
					<img
						ref={imgRef}
						src={src}
						alt={alt}
						loading={loading}
						onLoad={() => triggerReveal()}
						onError={onError}
						className={cn("v-image-pixel-reveal__image", imgClassName)}
					/>
				)}
			</div>

			{children ? (
				<img
					ref={imgRef}
					src={src}
					alt=""
					aria-hidden="true"
					loading={loading}
					onLoad={() => triggerReveal()}
					onError={onError}
					className="v-image-pixel-reveal__probe"
				/>
			) : null}

			<svg
				aria-hidden="true"
				focusable="false"
				width="0"
				height="0"
				className="v-image-pixel-reveal__tiles"
			>
				<defs>
					<mask
						id={maskId}
						className="v-image-pixel-reveal__mask"
						maskUnits="objectBoundingBox"
						maskContentUnits="objectBoundingBox"
						x="0"
						y="0"
						width="1"
						height="1"
					>
						<rect
							className="v-image-pixel-reveal__base"
							x="-1"
							y="-1"
							width="3"
							height="3"
							opacity={grid ? 0 : 1}
						/>
						{grid?.tiles.map((tile) => (
							<rect
								key={tile.index}
								className="v-image-pixel-reveal__tile"
								x={tile.x}
								y={tile.y}
								width={tile.width}
								height={tile.height}
								onAnimationEnd={
									tile.index === grid.lastTileIndex
										? () => completeReveal(grid.id)
										: undefined
								}
								style={{
									animationDelay: `${tile.delayMs}ms`,
									animationDuration: `${duration}s`,
								}}
							/>
						))}
					</mask>
				</defs>
			</svg>
		</div>
	);
}
