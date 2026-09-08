import { ArrowUpRight } from "lucide-react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { useState } from "react";
import styles from "./ProfileMention.module.css";
import type { ArticleProfile } from "./types";

interface ProfileMentionProps {
	label: string;
	profile?: ArticleProfile;
}

/** 行内人物提及；鼠标悬停与键盘聚焦共享同一档案浮层。 */
export function ProfileMention({ label, profile }: ProfileMentionProps) {
	const [open, setOpen] = useState(false);
	const visibleLabel = label.trim() || profile?.name || "人物档案";

	if (!profile) {
		return <span className={styles.unavailable}>{visibleLabel}</span>;
	}

	return (
		<HoverCardPrimitive.Root
			open={open}
			onOpenChange={setOpen}
			openDelay={120}
			closeDelay={100}
		>
			<HoverCardPrimitive.Trigger asChild>
				<a
					href={profile.href}
					className={styles.trigger}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
				>
					{visibleLabel}
					<span aria-hidden />
				</a>
			</HoverCardPrimitive.Trigger>
			<HoverCardPrimitive.Portal>
				<HoverCardPrimitive.Content
					side="top"
					align="center"
					sideOffset={10}
					collisionPadding={16}
					className={styles.card}
				>
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
						打开完整档案
						<ArrowUpRight aria-hidden />
					</p>
					<HoverCardPrimitive.Arrow className={styles.arrow} />
				</HoverCardPrimitive.Content>
			</HoverCardPrimitive.Portal>
		</HoverCardPrimitive.Root>
	);
}
