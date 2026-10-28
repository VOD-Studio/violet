import { cn } from "cn";
import { AppWindow, PanelTop, Pause } from "lucide-react";
import type { PresenceActivity } from "../lib/presence";
import styles from "./PresenceGlyph.module.css";

/**
 * 活动类型图标：播放中为电平条，暂停为暂停符号，应用与窗口用各自的窗口图标。
 */
export function PresenceGlyph({
	activity,
	className,
}: {
	activity: PresenceActivity;
	className?: string;
}) {
	if (activity.kind === "media" && activity.media.state === "playing") {
		return (
			<span aria-hidden="true" className={cn(styles.equalizer, className)}>
				<span className={styles.bar} />
				<span className={styles.bar} />
				<span className={styles.bar} />
			</span>
		);
	}
	const Icon =
		activity.kind === "media" ? Pause : activity.kind === "application" ? AppWindow : PanelTop;
	return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />;
}
