import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { cn } from "cn";
import type { ReactNode } from "react";

import styles from "./AboutSections.module.css";

interface AboutChapterProps {
	id: string;
	title: string;
	intro?: string;
	className?: string;
	children: ReactNode;
}

/** 为关于页内容提供一致的标题、锚点与阅读节奏。 */
export function AboutChapter({ id, title, intro, className, children }: AboutChapterProps) {
	return (
		<section aria-labelledby={id} className={cn(styles.chapter, className)}>
			<header className={styles.chapterHeader}>
				<AnchoredHeading
					id={id}
					className={styles.chapterTitle}
					linkLabel={`链接到“${title}”`}
				>
					{title}
				</AnchoredHeading>
				{intro ? <p className={styles.chapterIntro}>{intro}</p> : null}
			</header>
			<div className={styles.chapterBody}>{children}</div>
		</section>
	);
}
