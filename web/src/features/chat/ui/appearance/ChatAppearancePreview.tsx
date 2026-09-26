import type { ChatAppearance } from "../../model/appearance";
import { BUBBLE_BY_ID } from "../../model/appearance-catalog";
import type { ChatUser } from "../../model/types";
import { AppearanceBadgeStrip } from "./AppearanceBadgeStrip";
import { AppearanceBubbleSurface } from "./AppearanceBubbleSurface";
import { AvatarDecoration } from "./AvatarDecoration";
import styles from "./ChatAppearanceEditor.module.css";

export interface ChatAppearancePreviewProps {
	/** 未保存的草稿;预览期间不上传任何数据。 */
	appearance: ChatAppearance;
	/** 用户既有头像与昵称;预览不会改动用户本体。 */
	user: ChatUser;
}

export function ChatAppearancePreview({ appearance, user }: ChatAppearancePreviewProps) {
	const theme = BUBBLE_BY_ID.get(appearance.bubble_theme_id);
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
						{theme ? (
							<AppearanceBubbleSurface theme={theme} mine={false}>
								周末见，到了告诉我一声。
							</AppearanceBubbleSurface>
						) : (
							<div className={styles.defaultBubble}>周末见，到了告诉我一声。</div>
						)}
					</div>
				</div>
			</div>
		</aside>
	);
}
