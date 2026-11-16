import { Radio, RadioGroup } from "@violet/ui";
import { CircleSlash } from "lucide-react";
import type { AppearanceAsset } from "../../model/appearance";
import { BubbleShell } from "../bubble-shell";
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
	const isBubble = variant === "bubble";
	return (
		<RadioGroup
			legend={label}
			value={value}
			onValueChange={onChange}
			appearance="card"
			className={isBubble ? styles.bubbleGrid : styles.grid}
			disabled={disabled}
		>
			<Radio
				value=""
				label={
					<span className={styles.optionContent}>
						<span className={styles.figure} aria-hidden="true">
							{isBubble ? (
								<span className={styles.bubbleDemo}>
									<BubbleShell themeId="" mine>
										你好，周末见
									</BubbleShell>
								</span>
							) : (
								<span className={styles.emptyMold}>
									<CircleSlash aria-hidden className="size-4" />
								</span>
							)}
						</span>
						<span className={styles.optionName}>{isBubble ? "季节" : "不使用"}</span>
					</span>
				}
			/>
			{options.map((item) => (
				<Radio
					key={item.id}
					value={item.id}
					label={
						<span className={styles.optionContent}>
							<span className={styles.figure} aria-hidden="true">
								<Showpiece variant={variant} item={item} />
							</span>
							<span className={styles.optionName}>{item.name}</span>
						</span>
					}
				/>
			))}
		</RadioGroup>
	);
}

/** 展台内容:装饰必须落在头像模具上,气泡用真实迷你气泡而非切片原图。 */
function Showpiece({ variant, item }: { variant: OptionVariant; item: AppearanceAsset }) {
	if (variant === "bubble") {
		return (
			<span className={styles.bubbleDemo}>
				<BubbleShell themeId={item.id} mine>
					你好，周末见
				</BubbleShell>
			</span>
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
