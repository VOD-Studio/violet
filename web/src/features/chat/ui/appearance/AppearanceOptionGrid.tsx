import { CircleSlash } from "lucide-react";
import type { AppearanceAsset } from "../../model/appearance";
import { BUBBLE_BY_ID } from "../../model/appearance-catalog";
import { AppearanceBubbleSurface } from "./AppearanceBubbleSurface";
import { AvatarDecoration } from "./AvatarDecoration";
import styles from "./ChatAppearanceEditor.module.css";

/** 卡片的拟真展示形态:头像装饰落在模具上,气泡渲染真实迷你气泡。 */
export type OptionVariant = "frame" | "charm" | "bubble";

export interface AppearanceOptionGridProps {
	/** 无障碍分组名(tab 已承载可见分类名)。 */
	label: string;
	/** 卡片拟真形态,决定展台内的渲染方式。 */
	variant: OptionVariant;
	/** 目录白名单;首项展示默认形态。 */
	options: readonly AppearanceAsset[];
	/** 空串代表默认外观。 */
	value: string;
	/** 只更新草稿;选中不立即保存。 */
	onChange: (id: string) => void;
	/** 保存进行中禁止编辑。 */
	disabled?: boolean;
}

export function AppearanceOptionGrid({
	label,
	variant,
	options,
	value,
	onChange,
	disabled,
}: AppearanceOptionGridProps) {
	return (
		<fieldset className={styles.fieldset} disabled={disabled} aria-label={label}>
			<div className={styles.grid}>
				<button
					type="button"
					className={styles.option}
					aria-pressed={value === ""}
					onClick={() => onChange("")}
				>
					<span className={styles.figure} aria-hidden="true">
						{variant === "bubble" ? (
							<span className={styles.defaultOptionBubble}>你好，周末见</span>
						) : (
							<span className={styles.emptyMold}>
								<CircleSlash aria-hidden className="size-4" />
							</span>
						)}
						{value === "" && <CheckMark />}
					</span>
					<span className={styles.optionName}>
						{variant === "bubble" ? "默认气泡" : "不使用"}
					</span>
				</button>
				{options.map((item) => {
					const selected = value === item.id;
					return (
						<button
							key={item.id}
							type="button"
							className={styles.option}
							aria-pressed={selected}
							onClick={() => onChange(item.id)}
						>
							<span className={styles.figure} aria-hidden="true">
								<Showpiece variant={variant} item={item} />
								{selected && <CheckMark />}
							</span>
							<span className={styles.optionName}>{item.name}</span>
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

/** 展台内容:装饰必须落在头像模具上,气泡用真实迷你气泡而非切片原图。 */
function Showpiece({ variant, item }: { variant: OptionVariant; item: AppearanceAsset }) {
	if (variant === "bubble") {
		const theme = BUBBLE_BY_ID.get(item.id);
		if (!theme) return null;
		return (
			<AppearanceBubbleSurface theme={theme} mine={false} compact>
				你好，周末见
			</AppearanceBubbleSurface>
		);
	}
	return (
		<AvatarDecoration
			frameId={variant === "frame" ? item.id : ""}
			charmId={variant === "charm" ? item.id : ""}
		>
			<span aria-hidden className={styles.mold} />
		</AvatarDecoration>
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
