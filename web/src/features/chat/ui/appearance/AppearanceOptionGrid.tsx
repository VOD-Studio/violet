import { cn } from "@shared/lib/utils";
import type { AppearanceAsset } from "../../model/appearance";
import styles from "./ChatAppearanceEditor.module.css";

export interface AppearanceOptionGridProps {
	/** 无障碍分组名(tab 已承载可见分类名)。 */
	label: string;
	/** 目录中的安全选项;「不使用」动作用面板工具行,不占网格格位。 */
	options: readonly AppearanceAsset[];
	/** 本地草稿当前选中的 ID。 */
	value: string;
	/** 只更新草稿;选中不立即保存。 */
	onChange: (id: string) => void;
	/** 固定列数,保证目录项数恰好排满整行。 */
	columns: 4 | 6;
	/** 保存进行中禁止编辑。 */
	disabled?: boolean;
}

/** 单选装饰网格;选中项亮主色并打角标,原生按钮保证键盘与读屏可用。 */
export function AppearanceOptionGrid({
	label,
	options,
	value,
	onChange,
	columns,
	disabled,
}: AppearanceOptionGridProps) {
	return (
		<fieldset className={styles.fieldset} disabled={disabled} aria-label={label}>
			<div className={cn(styles.grid, columns === 4 ? styles.gridFour : styles.gridSix)}>
				{options.map((item) => (
					<button
						key={item.id}
						type="button"
						className={styles.option}
						aria-pressed={value === item.id}
						onClick={() => onChange(item.id)}
					>
						{value === item.id && <CheckMark />}
						<img
							src={item.image}
							alt=""
							loading="lazy"
							decoding="async"
							draggable={false}
						/>
						<span className={styles.optionName}>{item.name}</span>
					</button>
				))}
			</div>
		</fieldset>
	);
}

function CheckMark() {
	return (
		<span className={styles.check} aria-hidden="true">
			<svg viewBox="0 0 12 12" width="8" height="8" fill="none">
				<title>已选中</title>
				<path
					d="M2 6.2 4.8 9 10 3.4"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}
