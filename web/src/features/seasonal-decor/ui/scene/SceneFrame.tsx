/**
 * 插画的 svg 容器：统一 aria-hidden、指针穿透与入场门控。
 *
 * 渐变与滤镜的 id 前缀由 useId 派生，多幅插画同页不冲突；
 * playOnView 的插画进入视口前暂停在入场起点（.scene:not([data-play])）。
 */
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
	useEffect(() => {
		const element = ref.current;
		if (!playOnView || !element) return undefined;
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
	}, [playOnView]);
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
