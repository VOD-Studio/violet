import { CHAT_BADGES } from "@entities/chat-badge";
import { MAX_EQUIPPED_BADGES } from "../../model/appearance";
import styles from "./ChatAppearanceEditor.module.css";

export interface BadgeEquipGridProps {
	/** 已持有的徽章 ID;未加载完成时整体锁定,避免误选未持有项。 */
	ownedIDs: readonly string[] | undefined;
	/** 草稿佩戴列表,追加顺序即展示顺序。 */
	value: readonly string[];
	/** 只更新草稿;选中不立即保存。 */
	onChange: (ids: string[]) => void;
	/** 保存进行中禁止编辑。 */
	disabled?: boolean;
}

/** 徽章多选网格;选中角标显示佩戴顺序,未持有项锁定并标注,清空动作在面板工具行。 */
export function BadgeEquipGrid({ ownedIDs, value, onChange, disabled }: BadgeEquipGridProps) {
	const owned = ownedIDs === undefined ? null : new Set(ownedIDs);
	const toggle = (id: string) => {
		if (value.includes(id)) {
			onChange(value.filter((current) => current !== id));
			return;
		}
		if (value.length < MAX_EQUIPPED_BADGES) onChange([...value, id]);
	};
	return (
		<fieldset
			className={styles.fieldset}
			disabled={disabled || owned === null}
			aria-label="徽章"
		>
			<div className={styles.badgeGrid}>
				{CHAT_BADGES.map((badge) => {
					const isOwned = owned?.has(badge.id) ?? false;
					const order = value.indexOf(badge.id);
					const selected = order >= 0;
					return (
						<button
							key={badge.id}
							type="button"
							className={styles.badgeOption}
							aria-pressed={selected}
							disabled={!isOwned}
							onClick={() => toggle(badge.id)}
						>
							{selected && (
								<span className={styles.orderTag} aria-hidden="true">
									{order + 1}
								</span>
							)}
							{!isOwned && (
								<span className={styles.lockTag} aria-hidden="true">
									<svg viewBox="0 0 12 12" width="9" height="9" fill="none">
										<rect
											x="2.5"
											y="5"
											width="7"
											height="5"
											rx="1"
											stroke="currentColor"
											strokeWidth="1.2"
										/>
										<path
											d="M4 5V3.5a2 2 0 1 1 4 0V5"
											stroke="currentColor"
											strokeWidth="1.2"
										/>
									</svg>
									未获得
								</span>
							)}
							<img
								src={badge.image}
								alt=""
								loading="lazy"
								decoding="async"
								draggable={false}
							/>
							<span className={styles.optionName}>{badge.name}</span>
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}
