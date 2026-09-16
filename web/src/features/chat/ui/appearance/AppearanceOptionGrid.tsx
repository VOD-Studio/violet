import type { AppearanceAsset } from "../../model/appearance";
import styles from "./ChatAppearanceEditor.module.css";

export interface AppearanceOptionGridProps {
	/** 无障碍分组标题。 */
	label: string;
	/** 目录中的安全选项;“默认/空”选项由本组件补充。 */
	options: readonly AppearanceAsset[];
	/** 本地草稿当前选中的 ID。 */
	value: string;
	/** 只更新草稿;选中不立即保存。 */
	onChange: (id: string) => void;
	/** 保存进行中禁止编辑。 */
	disabled?: boolean;
}

/** 用原生可聚焦按钮,键盘/触摸/读屏开箱即用,无需自写按键处理。 */
export function AppearanceOptionGrid({
	label,
	options,
	value,
	onChange,
	disabled,
}: AppearanceOptionGridProps) {
	return (
		<fieldset className={styles.fieldset} disabled={disabled}>
			<legend className={styles.legend}>{label}</legend>
			<div className={styles.grid}>
				<button
					type="button"
					className={styles.option}
					aria-pressed={value === ""}
					onClick={() => onChange("")}
				>
					<span className={styles.empty}>—</span>
					<span>不使用</span>
				</button>
				{options.map((item) => (
					<button
						key={item.id}
						type="button"
						className={styles.option}
						aria-pressed={value === item.id}
						onClick={() => onChange(item.id)}
					>
						<img
							src={item.image}
							alt=""
							loading="lazy"
							decoding="async"
							draggable={false}
						/>
						<span>{item.name}</span>
					</button>
				))}
			</div>
		</fieldset>
	);
}
