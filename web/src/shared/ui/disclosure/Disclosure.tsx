import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import styles from "./Disclosure.module.css";

export interface DisclosureProps {
	summary: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
	variant?: "line" | "panel";
	className?: string;
	summaryClassName?: string;
	contentClassName?: string;
}

/** 带键盘语义与高度过渡的通用折叠面板。 */
export function Disclosure({
	summary,
	children,
	defaultOpen = false,
	variant = "line",
	className,
	summaryClassName,
	contentClassName,
}: DisclosureProps) {
	const [open, setOpen] = useState(defaultOpen);
	const contentId = useId();

	return (
		<div
			className={cn(styles.root, styles[variant], className)}
			data-open={open ? "true" : "false"}
		>
			<button
				type="button"
				className={cn(styles.summary, summaryClassName)}
				aria-expanded={open}
				aria-controls={contentId}
				onClick={() => setOpen((current) => !current)}
			>
				<span className={styles.summaryContent}>{summary}</span>
				<ChevronDown className={styles.chevron} aria-hidden />
			</button>
			<div id={contentId} className={styles.contentGrid} aria-hidden={!open} inert={!open}>
				<div className={styles.contentClip}>
					<div className={cn(styles.content, contentClassName)}>{children}</div>
				</div>
			</div>
		</div>
	);
}
