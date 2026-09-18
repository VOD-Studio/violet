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

/** 竖版实时预览:身份区随装饰联动,双气泡示意收发两个方向。 */
export function ChatAppearancePreview({ appearance, user }: ChatAppearancePreviewProps) {
	const theme = BUBBLE_BY_ID.get(appearance.bubble_theme_id);
	const label = user.display_name || user.username;
	const incoming = (
		<span>
			这条消息会随内容自然换行。
			<br />
			こんにちは，月光茶会 ☾
		</span>
	);
	const outgoing = <>好的 🌙</>;
	return (
		<aside className={styles.preview} aria-label="未保存的聊天外观预览">
			<div className={styles.previewHead}>
				<span className={styles.liveDot}>实时预览</span>
				<span className={styles.caption}>保存后对他人可见</span>
			</div>
			<div className={styles.previewIdentity}>
				<AvatarDecoration
					frameId={appearance.avatar_frame_id}
					charmId={appearance.avatar_charm_id}
				>
					{user.avatar_url ? (
						<img className={styles.face} src={user.avatar_url} alt={label} />
					) : (
						<span className={styles.face}>{label.slice(0, 1).toUpperCase()}</span>
					)}
				</AvatarDecoration>
				<span className={styles.identityName}>
					{label}
					<AppearanceBadgeStrip badgeIDs={appearance.badge_ids} />
				</span>
			</div>
			<div className={styles.previewBubble}>
				<div className={styles.previewRow}>
					{theme ? (
						<AppearanceBubbleSurface theme={theme} mine={false}>
							{incoming}
						</AppearanceBubbleSurface>
					) : (
						<div className={styles.defaultBubble}>{incoming}</div>
					)}
					<time className={styles.time} dateTime="2026-09-18T21:08:00+08:00">
						21:08
					</time>
				</div>
				<div className={styles.previewRowOutgoing}>
					<time className={styles.time} dateTime="2026-09-18T21:09:00+08:00">
						21:09
					</time>
					{theme ? (
						<AppearanceBubbleSurface theme={theme} mine>
							{outgoing}
						</AppearanceBubbleSurface>
					) : (
						<div className={styles.defaultOutgoing}>{outgoing}</div>
					)}
				</div>
			</div>
		</aside>
	);
}
