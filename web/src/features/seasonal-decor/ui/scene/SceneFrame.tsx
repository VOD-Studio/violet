/**
 * 插画的 svg 容器：统一 aria-hidden、指针穿透与入场门控。
 *
 * 渐变与滤镜的 id 前缀由 useId 派生，多幅插画同页不冲突；
 * playOnView 在客户端进入视口后播放；SSR 和未增强时保持最终画面。
 */
import { useReducedMotion } from "@shared/lib/motion";
import { cn } from "cn";
import { useEffect, useId, useRef, useState } from "react";

import styles from "../../scene.module.css";

export interface SceneFrameProps {
	viewBox: string;
	className: string;
	/** 进入视口才开始播放入场动画 */
	playOnView?: boolean;
	children: (prefix: string) => React.ReactNode;
}

export function SceneFrame({ viewBox, className, playOnView, children }: SceneFrameProps) {
	const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const ref = useRef<SVGSVGElement>(null);
	const [play, setPlay] = useState(!playOnView);
	const reduceMotion = useReducedMotion();
	useEffect(() => {
		const element = ref.current;
		if (!playOnView || !element || reduceMotion) return undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setPlay(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.6 },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [playOnView, reduceMotion]);
	return (
		<svg
			ref={ref}
			aria-hidden="true"
			viewBox={viewBox}
			data-play={play ? "" : undefined}
			className={cn(styles.scene, className)}
		>
			{children(prefix)}
		</svg>
	);
}
