import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import { type CSSProperties, useRef } from "react";

import styles from "./SectionNavigator.module.css";

export interface SectionNavigationItem {
	id: string;
	label: string;
}

export interface SectionNavigatorProps {
	items: readonly SectionNavigationItem[];
	activeId?: string | null;
	title?: string;
	ariaLabel?: string;
	className?: string;
}

/** 响应式页内章节导航；桌面显示阅读进度，窄屏收入原生折叠菜单。 */
export function SectionNavigator({
	items,
	activeId,
	title = "本页",
	ariaLabel = "页内章节",
	className,
}: SectionNavigatorProps) {
	const mobileRef = useRef<HTMLDetailsElement>(null);
	if (items.length === 0) return null;

	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === activeId),
	);
	const progress = ((activeIndex + 1) / items.length) * 100;
	const progressStyle = {
		"--section-progress": `${progress}%`,
	} as CSSProperties;

	return (
		<div className={cn(styles.root, className)} style={progressStyle}>
			<nav className={styles.rail} aria-label={ariaLabel}>
				<div className={styles.railHeader}>
					<span>{title}</span>
					<span>
						{String(activeIndex + 1).padStart(2, "0")}/
						{String(items.length).padStart(2, "0")}
					</span>
				</div>
				<div className={styles.railBody}>
					<span className={styles.track} aria-hidden>
						<span className={styles.trackFill} />
					</span>
					<NavigationItems items={items} activeId={activeId} activeIndex={activeIndex} />
				</div>
			</nav>

			<details ref={mobileRef} className={styles.mobile}>
				<summary className={styles.mobileSummary}>
					<span>{title}</span>
					<span className={styles.mobileCurrent}>{items[activeIndex]?.label}</span>
					<ChevronDown className={styles.mobileChevron} aria-hidden />
				</summary>
				<nav className={styles.mobileNav} aria-label={ariaLabel}>
					<NavigationItems
						items={items}
						activeId={activeId}
						activeIndex={activeIndex}
						onNavigate={() => mobileRef.current?.removeAttribute("open")}
					/>
				</nav>
			</details>
		</div>
	);
}

interface NavigationItemsProps {
	items: readonly SectionNavigationItem[];
	activeId?: string | null;
	activeIndex: number;
	onNavigate?: () => void;
}

function NavigationItems({ items, activeId, activeIndex, onNavigate }: NavigationItemsProps) {
	return (
		<ol className={styles.list}>
			{items.map((item, index) => {
				const active = item.id === activeId || (!activeId && index === 0);
				return (
					<li
						key={item.id}
						className={styles.item}
						data-active={active ? "true" : "false"}
						data-distance={Math.min(Math.abs(index - activeIndex), 2)}
					>
						<a
							href={`#${item.id}`}
							className={styles.link}
							aria-current={active ? "location" : undefined}
							onClick={onNavigate}
						>
							<span className={styles.index}>
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className={styles.label}>{item.label}</span>
						</a>
					</li>
				);
			})}
		</ol>
	);
}
