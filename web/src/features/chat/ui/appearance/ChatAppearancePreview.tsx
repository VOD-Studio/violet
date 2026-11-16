import { Avatar, Card } from "@violet/ui";
import { cn } from "cn";
import type { ChatAppearance } from "../../model/appearance";
import type { ChatBackground } from "../../model/appearance-background";
import type { ChatUser } from "../../model/types";
import { BubbleShell } from "../bubble-shell";
import { AppearanceBadgeStrip } from "./AppearanceBadgeStrip";
import { AvatarDecoration } from "./AvatarDecoration";
import styles from "./ChatAppearanceEditor.module.css";
import { chatBackgroundClassName } from "./useChatBackground";

/** 草稿即时预览使用真实气泡,不会发布尚未保存的外观。 */
export interface ChatAppearancePreviewProps {
	appearance: ChatAppearance;
	background: ChatBackground;
	user: ChatUser;
}

export function ChatAppearancePreview({
	appearance,
	background,
	user,
}: ChatAppearancePreviewProps) {
	const label = user.display_name || user.username;
	return (
		<Card
			role="complementary"
			aria-label="未保存的聊天外观预览"
			className={cn(styles.stage, chatBackgroundClassName(background))}
		>
			<span className={styles.sectionTitle}>预览</span>
			<div className={styles.previewRow}>
				<Avatar name="小林" size={32} />
				<div className={styles.previewMessage}>
					<BubbleShell mine={false}>
						新皮肤好看吗
						<time className={styles.previewTime} dateTime="09:02">
							09:02
						</time>
					</BubbleShell>
				</div>
			</div>
			<div className={cn(styles.previewRow, styles.previewMine)}>
				<div className={styles.previewMessage}>
					<span className={styles.identityName}>
						{label}
						<AppearanceBadgeStrip badgeIDs={appearance.badge_ids} />
					</span>
					<BubbleShell mine themeId={appearance.bubble_theme_id}>
						刚换的
						<time className={styles.previewTime} dateTime="09:03">
							09:03
						</time>
					</BubbleShell>
				</div>
				<AvatarDecoration
					frameId={appearance.avatar_frame_id}
					charmId={appearance.avatar_charm_id}
				>
					<Avatar src={user.avatar_url || undefined} name={label} size={32} />
				</AvatarDecoration>
			</div>
		</Card>
	);
}
