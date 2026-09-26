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
	// 气泡是横条素材:流式排列,素材本体即按钮;头像框/挂件是圆形素材,固定列网格
	const flow = variant === "bubble";
	const container = flow ? styles.flow : styles.grid;
	return (
		<fieldset className={styles.fieldset} disabled={disabled} aria-label={label}>
			<div className={container}>
				<button
					type="button"
					className={flow ? styles.flowOption : styles.option}
					aria-label={flow ? "默认气泡" : undefined}
					aria-pressed={value === ""}
					onClick={() => onChange("")}
				>
					{flow ? (
						<span className={styles.defaultOptionBubble}>你好，周末见</span>
					) : (
						<span className={styles.figure} aria-hidden="true">
							<span className={styles.emptyMold}>
								<CircleSlash aria-hidden className="size-4" />
							</span>
							{value === "" && <CheckMark />}
						</span>
					)}
					{!flow && (
						<span className={styles.optionName}>{flow ? "默认气泡" : "不使用"}</span>
					)}
					{flow && value === "" && <CheckMark />}
				</button>
				{options.map((item) => {
					const selected = value === item.id;
					return (
						<button
							key={item.id}
							type="button"
							className={flow ? styles.flowOption : styles.option}
							aria-label={flow ? item.name : undefined}
							aria-pressed={selected}
							onClick={() => onChange(item.id)}
						>
							{flow ? (
								<BubbleShowpiece item={item} />
							) : (
								<span className={styles.figure} aria-hidden="true">
									<Showpiece variant={variant} item={item} />
									{selected && <CheckMark />}
								</span>
							)}
							{!flow && <span className={styles.optionName}>{item.name}</span>}
							{flow && selected && <CheckMark />}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

/** 流式气泡:迷你气泡本体即按钮,带主题名供读屏。 */
function BubbleShowpiece({ item }: { item: AppearanceAsset }) {
	const theme = BUBBLE_BY_ID.get(item.id);
	if (!theme) return null;
	return (
		<AppearanceBubbleSurface theme={theme} mine={false} compact>
			你好，周末见
		</AppearanceBubbleSurface>
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
