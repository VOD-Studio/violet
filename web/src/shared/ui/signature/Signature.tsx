import { cn } from "@shared/lib/utils";
import { useReducedMotion } from "motion/react";
import { type HTMLAttributes, useCallback, useEffect, useRef, useState } from "react";

import styles from "./Signature.module.css";

export interface SignatureProps extends HTMLAttributes<HTMLSpanElement> {
	/** 签名显示名字（支持任意英文/拼音名字，全动态连笔呈现） */
	name?: string;
	/** 尺寸档位：sm (26px) | md (38px) | lg (52px)，默认 'md' */
	size?: "sm" | "md" | "lg";
	/** 墨水颜色变体：default (跟随文本色) | primary (品牌强调色) | muted (柔和浅灰)，默认 'default' */
	variant?: "default" | "primary" | "muted";
	/** 是否在鼠标悬停时重新播放手写笔迹展开动效，默认 true */
	replayOnHover?: boolean;
	/** 是否在初次挂载时自动播放书写动效，默认 true */
	autoPlay?: boolean;
}

/**
 * Signature: 纯动态西文手写连笔签名组件
 *
 * 采用经典西文连笔花体字形与 SVG 动态甩尾笔迹，根据配置的任意名字
 * 自动测宽并呈现行云流水的手写签名动效，无需为每个新名字手工重绘矢量图。
 */
export function Signature({
	name = "xunrua",
	size = "md",
	variant = "default",
	replayOnHover = true,
	autoPlay = true,
	className,
	...props
}: SignatureProps) {
	const textRef = useRef<HTMLSpanElement>(null);
	const reduceMotion = useReducedMotion();
	const [textWidth, setTextWidth] = useState(0);
	const [animating, setAnimating] = useState(autoPlay && !reduceMotion);
	const [animKey, setAnimKey] = useState(0);

	// 动态测量当前名字的真实渲染像素宽度
	const measureWidth = useCallback(() => {
		if (textRef.current) {
			const width = textRef.current.getBoundingClientRect().width;
			if (width > 0) {
				setTextWidth(width);
			}
		}
	}, []);

	useEffect(() => {
		measureWidth();
		if (typeof document !== "undefined" && "fonts" in document) {
			document.fonts.ready.then(measureWidth);
		}
	}, [measureWidth]);

	// 监听名字切换，重置并重新播放签名动效
	useEffect(() => {
		if (autoPlay && !reduceMotion) {
			setAnimating(true);
			setAnimKey((k) => k + 1);
		}
	}, [autoPlay, reduceMotion]);

	// 悬停重播
	const handleMouseEnter = () => {
		if (replayOnHover && !reduceMotion && !animating) {
			setAnimating(true);
			setAnimKey((k) => k + 1);
		}
	};

	// 动画播放完成后平稳归位
	const handleAnimationEnd = () => {
		setAnimating(false);
	};

	// 尺寸与变体样式类映射
	const sizeClass = size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd;
	const variantClass =
		variant === "primary"
			? styles.variantPrimary
			: variant === "muted"
				? styles.variantMuted
				: styles.variantDefault;

	// 动态计算末尾手写甩尾（Swash）的水平起点与整幅 SVG 的自适应宽度
	const startX = Math.max(0, textWidth - 6);
	const swashWidth = 64;
	const svgTotalWidth = startX + swashWidth + 10;

	return (
		<span
			role="img"
			aria-label={`作者手写签名：${name}`}
			onMouseEnter={handleMouseEnter}
			className={cn(
				styles.root,
				sizeClass,
				variantClass,
				animating && styles.drawing,
				className,
			)}
			{...props}
		>
			{/* 手写文字主体 */}
			<span
				key={`text-${animKey}-${name}`}
				ref={textRef}
				aria-hidden="true"
				onAnimationEnd={handleAnimationEnd}
				className={styles.text}
			>
				{name}
			</span>

			{/* 连笔末尾的动态艺术甩尾飞白线 */}
			{textWidth > 0 ? (
				<svg
					key={`swash-${animKey}-${name}`}
					aria-hidden="true"
					className={styles.swashWrapper}
					style={{
						width: `${svgTotalWidth}px`,
						height: "36px",
						transform: "translateY(-15%)",
					}}
					viewBox={`0 0 ${svgTotalWidth} 36`}
				>
					<path
						className={styles.swashPath}
						d={`M ${startX} 22 C ${startX + 14} 27, ${startX + 28} 25, ${startX + 44} 21 S ${startX + 58} 18, ${startX + 68} 20`}
					/>
				</svg>
			) : null}
		</span>
	);
}
