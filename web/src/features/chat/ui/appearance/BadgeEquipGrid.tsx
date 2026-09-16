import { CHAT_BADGES } from "@entities/chat-badge";
import { cn } from "@shared/lib/utils";
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

/** 徽章多选佩戴,至多三枚;未持有项锁定展示,授予后自动可选。 */
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
		<fieldset className={styles.fieldset} disabled={disabled || owned === null}>
			<legend className={styles.legend}>
				徽章
				<span className={styles.legendHint}>
					{owned === null
						? "持有记录加载中…"
						: `已选 ${value.length}/${MAX_EQUIPPED_BADGES}`}
				</span>
			</legend>
			<div className={styles.badgeGrid}>
				{CHAT_BADGES.map((badge) => {
					const isOwned = owned?.has(badge.id) ?? false;
					const selected = value.includes(badge.id);
					return (
						<button
							key={badge.id}
							type="button"
							className={cn(
								styles.option,
								styles.badgeOption,
								!isOwned && styles.locked,
							)}
							aria-pressed={selected}
							disabled={!isOwned}
							onClick={() => toggle(badge.id)}
						>
							<img
								src={badge.image}
								alt=""
								loading="lazy"
								decoding="async"
								draggable={false}
							/>
							<span>{isOwned ? badge.name : `${badge.name} · 未获得`}</span>
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}
