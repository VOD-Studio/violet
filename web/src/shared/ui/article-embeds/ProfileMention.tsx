import { HoverCard, HoverCardContent, HoverCardTrigger } from "@violet/ui";
import { ArrowUpRight } from "lucide-react";
import styles from "./ProfileMention.module.css";
import type { ArticleProfile } from "./types";

interface ProfileMentionProps {
	label: string;
	profile?: ArticleProfile;
	actionLabel?: string;
}

/** 行内人物提及；鼠标悬停与键盘聚焦共享同一档案浮层，时序与外壳由 HoverCard 提供。 */
export function ProfileMention({
	label,
	profile,
	actionLabel = "打开完整档案",
}: ProfileMentionProps) {
	const visibleLabel = label.trim() || profile?.name || "人物档案";

	if (!profile) {
		return <span className={styles.unavailable}>{visibleLabel}</span>;
	}

	return (
		<HoverCard>
			<HoverCardTrigger asChild>
				<a href={profile.href} className={styles.trigger}>
					{visibleLabel}
					<span aria-hidden />
				</a>
			</HoverCardTrigger>
			<HoverCardContent>
				<div className={styles.identity}>
					{profile.avatarUrl ? (
						<img src={profile.avatarUrl} alt="" className={styles.avatar} />
					) : (
						<span className={styles.avatarFallback} aria-hidden>
							{profile.name.slice(0, 1)}
						</span>
					)}
					<div>
						<p className={styles.name}>{profile.name}</p>
						{profile.subtitle ? (
							<p className={styles.subtitle}>{profile.subtitle}</p>
						) : null}
					</div>
				</div>
				{profile.description ? (
					<p className={styles.description}>{profile.description}</p>
				) : null}
				<p className={styles.openHint}>
					{actionLabel}
					<ArrowUpRight aria-hidden />
				</p>
			</HoverCardContent>
		</HoverCard>
	);
}
