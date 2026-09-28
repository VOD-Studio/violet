import type { ChatAppearance } from "../../model/appearance";
import type { ChatUser } from "../../model/types";
import { BubbleShell } from "../bubble-shell";
import { AppearanceBadgeStrip } from "./AppearanceBadgeStrip";
import { AvatarDecoration } from "./AvatarDecoration";
import styles from "./ChatAppearanceEditor.module.css";

export interface ChatAppearancePreviewProps {
	/** 未保存的草稿;预览期间不上传任何数据。 */
	appearance: ChatAppearance;
	/** 用户既有头像与昵称;预览不会改动用户本体。 */
	user: ChatUser;
}

export function ChatAppearancePreview({ appearance, user }: ChatAppearancePreviewProps) {
	const label = user.display_name || user.username;

	return (
		<aside aria-label="未保存的聊天外观预览" className={styles.stageShell}>
			<div className={styles.stage}>
				<div className={styles.previewRow}>
					<div className={styles.previewAvatar}>
						<AvatarDecoration
							frameId={appearance.avatar_frame_id}
							charmId={appearance.avatar_charm_id}
						>
							{user.avatar_url ? (
								<img className={styles.face} src={user.avatar_url} alt="" />
							) : (
								<span className={styles.face} aria-hidden="true">
									{label.slice(0, 1).toUpperCase()}
								</span>
							)}
						</AvatarDecoration>
					</div>
					<div className={styles.previewMessage}>
						<span className={styles.identityName}>
							{label}
							<AppearanceBadgeStrip badgeIDs={appearance.badge_ids} />
						</span>
						<BubbleShell mine={false} themeId={appearance.bubble_theme_id}>
							周末见，到了告诉我一声。
						</BubbleShell>
					</div>
				</div>
			</div>
		</aside>
	);
}
