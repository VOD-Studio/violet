import { copyText } from "@shared/lib/clipboard";
import { cn } from "cn";
import { CopyCheck, Link } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
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
	const [copied, setCopied] = useState(false);
	const resetTimer = useRef<number | undefined>(undefined);

	useEffect(
		() => () => {
			clearTimeout(resetTimer.current);
		},
		[],
	);

	const copyLink = async () => {
		const url = new URL(window.location.href);
		url.hash = id;
		if (await copyText(url.href)) {
			clearTimeout(resetTimer.current);
			setCopied(true);
			resetTimer.current = window.setTimeout(() => {
				setCopied(false);
				resetTimer.current = undefined;
			}, 2000);
			toast.success("已复制章节链接");
		} else toast.error("复制链接失败");
	};

	return (
		<Heading id={id} className={cn(styles.heading, className)} style={style}>
			<span>{children}</span>
			<button
				type="button"
				onClick={() => void copyLink()}
				className={styles.copyLink}
				data-copied={copied}
				aria-label={copied ? "已复制章节链接" : copyLabel}
				title={copied ? "已复制章节链接" : copyLabel}
			>
				{copied ? <CopyCheck aria-hidden /> : <Link aria-hidden />}
			</button>
		</Heading>
	);
}
