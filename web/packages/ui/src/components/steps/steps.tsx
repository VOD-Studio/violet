import { cn } from "cn";
import { Check } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/** 一步流程的名称与可省略说明；名称用于可访问名称，必须是纯文本。 */
export interface StepItem {
	/** 步骤名，写动作结果，如「验证站点」 */
	title: string;
	/** 说明，写这一步的对象或状态 */
	description?: ReactNode;
}

/** 当前一步的语气；出错只改变当前一步，不改变已验证的步骤。 */
export type StepsTone = "process" | "error";

export interface StepsProps extends Omit<ComponentProps<"ol">, "children"> {
	/** 三到五步；更多时拆成阶段 */
	steps: readonly StepItem[];
	/** 当前进行到第几步，从 0 开始；之前的步骤视为已完成 */
	current: number;
	/** 横排用于页内流程，竖排用于侧栏或说明较长时 */
	orientation?: "horizontal" | "vertical";
	/** 当前一步的语气；默认 process */
	tone?: StepsTone;
	/** 点已完成的圆点回到该步；不传时已完成的圆点也不可点 */
	onStepClick?: (index: number) => void;
}

function stepStatus(index: number, current: number, tone: StepsTone) {
	if (index < current) return "done" as const;
	if (index > current) return "upcoming" as const;
	return tone === "error" ? ("error" as const) : ("current" as const);
}

const STATUS_LABEL = {
	done: "已完成",
	current: "进行中",
	upcoming: "未开始",
	error: "出错",
} as const;

/**
 * 一条流程的步骤指示：已完成打勾、当前一步墨色实心、未到的空心，连接线只画到已走过的位置。
 *
 * @remarks
 * 只有已完成的步骤可以点回去，且必须提供 `onStepClick`；未到与当前步骤的圆点不可交互。
 * 状态同时以视觉、读屏文本与 `aria-current="step"` 表达，不依赖颜色。
 */
export function Steps({
	steps,
	current,
	orientation = "horizontal",
	tone = "process",
	onStepClick,
	className,
	...props
}: StepsProps) {
	return (
		<ol
			data-slot="steps"
			data-orientation={orientation}
			className={cn("v-steps", className)}
			style={{ "--v-steps-count": Math.max(steps.length, 1) } as CSSProperties}
			{...props}
		>
			{steps.map((step, index) => {
				const status = stepStatus(index, current, tone);
				const clickable = status === "done" && onStepClick !== undefined;
				const content = (
					<>
						{status === "done" ? (
							<Check aria-hidden="true" />
						) : status === "error" ? (
							<b>!</b>
						) : (
							<span>{index + 1}</span>
						)}
					</>
				);
				return (
					<li
						key={`${index}-${step.title}`}
						className="v-steps__item"
						data-status={status}
						aria-current={
							status === "current" || status === "error" ? "step" : undefined
						}
					>
						{clickable ? (
							<button
								type="button"
								className="v-steps__dot"
								aria-label={`第 ${index + 1} 步，${step.title}，${STATUS_LABEL[status]}`}
								onClick={() => onStepClick(index)}
							>
								{content}
							</button>
						) : (
							<span className="v-steps__dot" aria-hidden="true">
								{content}
							</span>
						)}
						{index < steps.length - 1 ? (
							<i className="v-steps__line" aria-hidden="true" />
						) : null}
						<span className="v-steps__text">
							<b className="v-steps__title">{step.title}</b>
							{step.description ? (
								<span className="v-steps__description">{step.description}</span>
							) : null}
						</span>
						<span className="v-steps__status">{STATUS_LABEL[status]}</span>
					</li>
				);
			})}
		</ol>
	);
}
