import { cn } from "@shared/lib/utils";
import { useReducedMotion } from "motion/react";
import { type HTMLAttributes, useCallback, useEffect, useRef, useState } from "react";

import styles from "./Signature.module.css";
import { DEFAULT_SIGNATURE_NAME, getSignaturePreset } from "./signature-presets";

export interface SignatureProps extends HTMLAttributes<HTMLSpanElement> {
	/** 签名名字（支持 xunrua / Violet 专属笔顺，以及任意自定义名字，默认 xunrua） */
	name?: string;
	/** 尺寸档位：sm (38px 高) | md (52px 高) | lg (68px 高)，默认 'md' */
	size?: "sm" | "md" | "lg";
	/** 墨水颜色变体：default (随前景色) | primary (品牌强调色) | muted (沉静浅炭墨)，默认 'default' */
	variant?: "default" | "primary" | "muted";
	/** 是否在鼠标悬停时重新播放手写笔迹书写动效，默认 true */
	replayOnHover?: boolean;
	/** 是否在初次挂载时自动播放书写动效，默认 true */
	autoPlay?: boolean;
}

/**
 * Signature: 纯正矢量笔画手写连笔签名组件
 *
 * 数据与视图分离：具体名字的真实手写笔顺与矢量数据定于 signature-presets.ts。
 * 组件基于按笔顺时序接力的 SVG 单线手写轨迹，呈现真人提笔挥毫的书写效果。
 */
export function Signature({
	name = DEFAULT_SIGNATURE_NAME,
	size = "md",
	variant = "default",
	replayOnHover = true,
	autoPlay = true,
	className,
	...props
}: SignatureProps) {
	const reduceMotion = useReducedMotion();
	const svgRef = useRef<SVGSVGElement>(null);
	const timeoutsRef = useRef<number[]>([]);
	const [isPlaying, setIsPlaying] = useState(false);

	const preset = getSignaturePreset(name);

	// 清理正在等待的笔画延迟定时器
	const clearTimeouts = useCallback(() => {
		for (const id of timeoutsRef.current) {
			window.clearTimeout(id);
		}
		timeoutsRef.current = [];
	}, []);

	// 执行真人手写笔顺接力动效
	const playAnimation = useCallback(() => {
		if (reduceMotion) {
			setIsPlaying(false);
			return;
		}

		clearTimeouts();
		setIsPlaying(true);

		const svg = svgRef.current;
		if (!svg) return;

		const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path[data-stroke-index]"));

		// 重置所有笔画到起点（准备落笔）
		for (const p of paths) {
			const len = p.getTotalLength();
			p.style.transition = "none";
			p.style.strokeDasharray = `${len} ${len}`;
			p.style.strokeDashoffset = `${len}`;
		}

		// 强制触发一次回流以使初始 strokeDashoffset 生效
		void svg.getBoundingClientRect();

		// 按物理笔顺时序逐笔挥毫
		let maxEndMs = 0;
		paths.forEach((p) => {
			const index = Number(p.getAttribute("data-stroke-index") || "0");
			const stroke = preset.strokes[index];
			if (!stroke) return;

			const startDelayMs = stroke.delay * 1000;
			const endMs = startDelayMs + stroke.duration * 1000;
			if (endMs > maxEndMs) maxEndMs = endMs;

			const timeoutId = window.setTimeout(() => {
				p.style.transition = `stroke-dashoffset ${stroke.duration}s cubic-bezier(0.35, 0.05, 0.2, 1)`;
				p.style.strokeDashoffset = "0";
			}, startDelayMs);

			timeoutsRef.current.push(timeoutId);
		});

		// 笔迹全部书写完成后状态归定
		const finishTimeoutId = window.setTimeout(() => {
			setIsPlaying(false);
		}, maxEndMs + 50);
		timeoutsRef.current.push(finishTimeoutId);
	}, [clearTimeouts, preset, reduceMotion]);

	// 初次挂载或名字切换时自动书写
	useEffect(() => {
		if (autoPlay) {
			playAnimation();
		} else {
			// 若不自动播放，直接呈现完整书写形态
			const svg = svgRef.current;
			if (svg) {
				const paths = Array.from(
					svg.querySelectorAll<SVGPathElement>("path[data-stroke-index]"),
				);
				for (const p of paths) {
					p.style.transition = "none";
					p.style.strokeDashoffset = "0";
				}
			}
		}

		return () => {
			clearTimeouts();
		};
	}, [autoPlay, playAnimation, clearTimeouts]);

	// 鼠标悬停重新挥毫书写
	const handleMouseEnter = () => {
		if (replayOnHover && !isPlaying) {
			playAnimation();
		}
	};

	// 尺寸与颜色变体映射
	const sizeClass = size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd;
	const variantClass =
		variant === "primary"
			? styles.variantPrimary
			: variant === "muted"
				? styles.variantMuted
				: styles.variantDefault;

	return (
		<span
			role="img"
			aria-label={`作者手写签名：${name}`}
			onMouseEnter={handleMouseEnter}
			className={cn(styles.root, sizeClass, variantClass, className)}
			{...props}
		>
			<svg ref={svgRef} viewBox={preset.viewBox} className={styles.svg} aria-hidden="true">
				{preset.strokes.map((stroke, index) => (
					<path
						key={stroke.d}
						data-stroke-index={index}
						d={stroke.d}
						className={styles.stroke}
						style={{
							strokeWidth: stroke.width ?? 3,
						}}
					/>
				))}
			</svg>
		</span>
	);
}
