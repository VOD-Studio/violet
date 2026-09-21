import { cn } from "@shared/lib/utils";
import { Hash } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import styles from "./AnchoredHeading.module.css";

export interface AnchoredHeadingProps {
	as?: "h2" | "h3" | "h4";
	id: string;
	anchorId?: string;
	children: ReactNode;
	className?: string;
	linkLabel?: string;
	/** 透传 inline 样式（正文标题可携带编辑器写入的颜色/对齐）。 */
	style?: CSSProperties;
}

/** 在悬停与键盘聚焦时显露原生章节锚点。 */
export function AnchoredHeading({
	as: Heading = "h2",
	id,
	anchorId = id,
	children,
	className,
	linkLabel = "链接到此章节",
	style,
}: AnchoredHeadingProps) {
	return (
		<Heading id={id} className={cn(styles.heading, className)} style={style}>
			<span>{children}</span>
			<a href={`#${anchorId}`} className={styles.anchor} aria-label={linkLabel}>
				<Hash aria-hidden />
			</a>
		</Heading>
	);
}
