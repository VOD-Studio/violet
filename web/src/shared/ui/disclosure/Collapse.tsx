import { cn } from "cn";
import { type ReactNode, useEffect, useState } from "react";

import styles from "./Disclosure.module.css";

/** 收起过渡的时长，与样式里的 140ms 同步，过后才卸载内容。 */
const COLLAPSE_MS = 140;

export interface CollapseProps {
	/** 是否展开；由调用方持有，没有自带的触发器 */
	open: boolean;
	children: ReactNode;
	/**
	 * 收起后保留内容挂载，草稿与内部状态不丢；默认在收起过渡走完后卸载。
	 *
	 * @default false
	 */
	keepMounted?: boolean;
	className?: string;
	/** 内容层的样式；与上方内容的间距写在这里，随高度一起展开 */
	contentClassName?: string;
}

/**
 * 受控的展开与收起：高度由零长到内容高度并淡入（200ms），收起更快（140ms）。
 *
 * @remarks 收起期间内容不可交互（inert）。裁切层留出聚焦环向外扩的 4px，
 * 里面的输入框聚焦环不会缺一截。初始即展开时不播入场。需要自带触发器的场景用 Disclosure。
 */
export function Collapse({
	open,
	children,
	keepMounted = false,
	className,
	contentClassName,
}: CollapseProps) {
	const [mounted, setMounted] = useState(open);
	// 一开始就展开的不播入场；之后每次从卸载状态展开才播
	const [animateIn] = useState(!open);
	useEffect(() => {
		if (open) {
			setMounted(true);
			return;
		}
		const timer = window.setTimeout(() => setMounted(false), COLLAPSE_MS);
		return () => window.clearTimeout(timer);
	}, [open]);
	if (!keepMounted && !open && !mounted) return null;
	return (
		<div
			className={cn(styles.collapse, className)}
			data-open={open ? "true" : "false"}
			data-animate-in={animateIn ? "true" : undefined}
			inert={!open}
		>
			<div className={styles.collapseClip}>
				<div className={contentClassName}>{children}</div>
			</div>
		</div>
	);
}
