import { cn } from "@shared/lib/utils";
import { useEffect, useRef } from "react";

export interface SpriteSheetProps {
	/** 雪碧图资源路径（public 目录相对路径或完整 URL）。 */
	src: string;
	/** 列数。 */
	cols: number;
	/**
	 * 行数。
	 *
	 * @default 1（单行胶卷）
	 */
	rows?: number;
	/**
	 * 有效帧数；末行不满格时手动指定（如 5×3 网格实际只有 14 帧则传 14）。
	 *
	 * @default cols × rows
	 */
	frames?: number;
	/**
	 * 每秒帧数。
	 *
	 * @default 5
	 */
	fps?: number;
	/**
	 * 单帧宽高比。
	 *
	 * @default "1 / 1"
	 */
	aspectRatio?: string;
	/** 暂停动画（静止在当前帧）。 */
	paused?: boolean;
	/** 追加到根元素的样式类（宽度由调用方控制）。 */
	className?: string;
}

/**
 * 通用雪碧图逐帧动画。
 *
 * 支持单行胶卷（1×N）与多行网格（C×R），只需传入列数与行数，
 * 组件自动计算每帧 `background-position`，无需手写 CSS 关键帧。
 * 宽度由调用方 className 控制，高度由 aspectRatio 自动推导。
 *
 * @example
 * ```tsx
 * // 单行 15 帧、5fps
 * <SpriteSheet src="/persona/rua.webp" cols={15} className="w-48" />
 *
 * // 多行网格 5×3、共 15 帧、3 秒循环
 * <SpriteSheet src="/sprite.webp" cols={5} rows={3} fps={5} className="w-32" />
 *
 * // 末行不满：4×3 网格实际 10 帧
 * <SpriteSheet src="/sprite.webp" cols={4} rows={3} frames={10} />
 * ```
 */
export function SpriteSheet({
	src,
	cols,
	rows = 1,
	frames,
	fps = 5,
	aspectRatio = "1 / 1",
	paused = false,
	className,
}: SpriteSheetProps) {
	const totalFrames = frames ?? cols * rows;
	const ref = useRef<HTMLSpanElement>(null);
	const frameRef = useRef(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

		const positionAt = (f: number) => {
			const col = f % cols;
			const row = Math.floor(f / cols);
			const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
			const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
			el.style.backgroundPosition = `${x}% ${y}%`;
		};

		// 减弱动态模式或暂停时，停在最后一帧
		if (mql.matches || paused) {
			positionAt(totalFrames - 1);
			return;
		}

		frameRef.current = 0;
		positionAt(0);

		const id = setInterval(() => {
			frameRef.current = (frameRef.current + 1) % totalFrames;
			positionAt(frameRef.current);
		}, 1000 / fps);

		// 响应运行时无障碍偏好切换
		const onMqlChange = () => {
			if (mql.matches) {
				clearInterval(id);
				positionAt(totalFrames - 1);
			}
		};
		mql.addEventListener("change", onMqlChange);

		return () => {
			clearInterval(id);
			mql.removeEventListener("change", onMqlChange);
		};
	}, [cols, rows, totalFrames, fps, paused]);

	return (
		<span
			ref={ref}
			aria-hidden="true"
			className={cn("block shrink-0", className)}
			style={{
				aspectRatio,
				backgroundImage: `url("${src}")`,
				backgroundRepeat: "no-repeat",
				backgroundPosition: "0% 0%",
				backgroundSize: `${cols * 100}% ${rows * 100}%`,
			}}
		/>
	);
}
