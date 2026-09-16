import type { ChatAppearance } from "../../model/appearance";
import { BUBBLE_BY_ID } from "../../model/appearance-catalog";
import type { ChatUser } from "../../model/types";
import { AppearanceBubbleSurface } from "./AppearanceBubbleSurface";
import { AvatarDecoration } from "./AvatarDecoration";
import styles from "./ChatAppearanceEditor.module.css";

export interface ChatAppearancePreviewProps {
	/** 未保存的草稿;预览期间不上传任何数据。 */
	appearance: ChatAppearance;
	/** 用户既有头像与昵称;预览不会改动用户本体。 */
	user: ChatUser;
}

/** 预览用真实 HTML 文本与生产装饰组件,同时展示左右两个方向。 */
export function ChatAppearancePreview({ appearance, user }: ChatAppearancePreviewProps) {
	const theme = BUBBLE_BY_ID.get(appearance.bubble_theme_id);
	const label = user.display_name || user.username;
	const sample = (
		<>
			<span>
				这条消息会随内容自然换行。
				<br />
				こんにちは，月光茶会 ☾
			</span>
			<time data-chat-timestamp="" className={styles.time}>
				21:08
			</time>
		</>
	);
	return (
		<section className={styles.preview} aria-label="未保存的聊天外观预览">
			<span className={styles.caption}>实时预览 · 保存后对他人可见</span>
			<div className={styles.previewRow}>
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
				<div className={styles.previewContent}>
					<span className={styles.caption}>{label}</span>
					{theme ? (
						<AppearanceBubbleSurface theme={theme} mine={false}>
							{sample}
						</AppearanceBubbleSurface>
					) : (
						<div className={styles.defaultBubble}>{sample}</div>
					)}
				</div>
			</div>
			<div className={styles.outgoing}>
				{theme ? (
					<AppearanceBubbleSurface theme={theme} mine>
						好的 🌙
						<time data-chat-timestamp="" className={styles.time}>
							21:09
						</time>
					</AppearanceBubbleSurface>
				) : (
					<div className={styles.defaultOutgoing}>好的 🌙</div>
				)}
			</div>
		</section>
	);
}
