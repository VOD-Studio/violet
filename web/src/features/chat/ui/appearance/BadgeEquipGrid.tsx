import { CHAT_BADGES } from "@entities/chat-badge";
import { Badge, Checkbox, Label } from "@violet/ui";
import { useId } from "react";
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

/** 徽章多选网格;选中状态由 Checkbox 表达,佩戴顺序和未持有原因直接展示。 */
export function BadgeEquipGrid({ ownedIDs, value, onChange, disabled }: BadgeEquipGridProps) {
	const id = useId();
	const owned = ownedIDs === undefined ? null : new Set(ownedIDs);
	const setChecked = (badgeID: string, checked: boolean) => {
		if (!checked) {
			onChange(value.filter((current) => current !== badgeID));
			return;
		}
		if (value.length < MAX_EQUIPPED_BADGES && !value.includes(badgeID)) {
			onChange([...value, badgeID]);
		}
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
					const atLimit = !selected && value.length >= MAX_EQUIPPED_BADGES;
					const controlID = `${id}-${badge.id}`;
					const statusID = `${controlID}-status`;
					return (
						<div key={badge.id} className={styles.badgeOption}>
							<Checkbox
								id={controlID}
								aria-label={badge.name}
								aria-describedby={
									selected || !isOwned || atLimit ? statusID : undefined
								}
								checked={selected}
								disabled={disabled || owned === null || !isOwned || atLimit}
								onCheckedChange={(checked) =>
									setChecked(badge.id, checked === true)
								}
							/>
							<Label htmlFor={controlID} className={styles.badgeLabel}>
								<img
									src={badge.image}
									alt=""
									loading="lazy"
									decoding="async"
									draggable={false}
								/>
								<span className={styles.optionName}>{badge.name}</span>
								{selected ? (
									<Badge id={statusID}>第 {order + 1} 枚</Badge>
								) : !isOwned ? (
									<Badge id={statusID} tone="off">
										未获得
									</Badge>
								) : atLimit ? (
									<Badge id={statusID} tone="off">
										已达上限
									</Badge>
								) : null}
							</Label>
						</div>
					);
				})}
			</div>
		</fieldset>
	);
}
