import { copyText } from "@shared/lib/clipboard";
import { cn } from "cn";
import { Link2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";

import styles from "./AnchoredHeading.module.css";

export interface AnchoredHeadingProps {
	as?: "h2" | "h3" | "h4";
	id: string;
	children: ReactNode;
	className?: string;
	copyLabel?: string;
	/** 透传 inline 样式（正文标题可携带编辑器写入的颜色/对齐）。 */
	style?: CSSProperties;
}

/** 标题保留直达锚点，右侧按钮复制包含该锚点的页面链接。 */
export function AnchoredHeading({
	as: Heading = "h2",
	id,
	children,
	className,
	copyLabel = "复制此章节链接",
	style,
}: AnchoredHeadingProps) {
	const copyLink = async () => {
		const url = new URL(window.location.href);
		url.hash = id;
		if (await copyText(url.href)) toast.success("已复制章节链接");
		else toast.error("复制链接失败");
	};

	return (
		<Heading id={id} className={cn(styles.heading, className)} style={style}>
			<span>{children}</span>
			<button
				type="button"
				onClick={() => void copyLink()}
				className={styles.copyLink}
				aria-label={copyLabel}
				title={copyLabel}
			>
				<Link2 aria-hidden />
			</button>
		</Heading>
	);
}
