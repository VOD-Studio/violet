import { cn } from "cn";
import { type ComponentProps, type CSSProperties, type ReactNode, useId } from "react";

/** 进度的结果语气：进行中、完成、失败。 */
export type ProgressStatus = "process" | "success" | "error";

/** 条形进度可附带分段，用来表示流程中的几个阶段。 */
export interface ProgressSegments {
	/** 分段数量 */
	count: number;
	/** 已经走过的分段数 */
	active: number;
}

export interface ProgressBarProps extends Omit<ComponentProps<"div">, "children"> {
	/** 百分比，0–100；超出范围按边界处理 */
	value: number;
	/** 正在做什么；同时作为读屏名称 */
	label?: ReactNode;
	/** 完成、失败或等待的补充说明 */
	hint?: ReactNode;
	/** 结果语气；默认 process */
	status?: ProgressStatus;
	/** 阶段数量少且需要一眼数出来时使用 */
	segments?: ProgressSegments;
}

export interface ProgressRingProps extends Omit<ComponentProps<"div">, "children"> {
	/** 百分比，0–100；超出范围按边界处理 */
	value: number;
	/** 48 用于卡片目标，32 用于紧凑区域 */
	size?: 32 | 48;
	/** 目标名称；同时作为读屏名称 */
	label?: ReactNode;
	/** 目标下方的进度说明，如「已读 13 / 20 篇」 */
	description?: ReactNode;
	/** 结果语气；默认 process */
	status?: ProgressStatus;
}

function valueText(value: number, status: ProgressStatus) {
	const percent = `${Math.round(value)}%`;
	if (status === "success") return "已完成";
	if (status === "error") return `${percent}，失败`;
	return percent;
}

/**
 * 知道百分比时的进度条：墨色表示已经走过，完成转成功色，失败转危险色。
 *
 * @remarks
 * 前进用 `scaleX` 过渡 300ms，不改宽度；减弱动态下直接跳到新值。
 * 分段只补充阶段信息，不替代 `aria-valuenow`。
 */
export function ProgressBar({
	value,
	label,
	hint,
	status = "process",
	segments,
	className,
	...props
}: ProgressBarProps) {
	const labelId = useId();
	const percent = Math.min(100, Math.max(0, value));
	const { "aria-label": ariaLabel, ...rest } = props;
	return (
		<div data-slot="progress-bar" className={cn("v-progress", className)} {...rest}>
			{label !== undefined || hint !== undefined ? (
				<div className="v-progress__head">
					{label !== undefined ? (
						<span className="v-progress__label" id={labelId}>
							{label}
						</span>
					) : (
						<span />
					)}
					<span className="v-progress__value">{`${Math.round(percent)}%`}</span>
				</div>
			) : null}
			<div
				className="v-progress__track"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(percent)}
				aria-valuetext={valueText(percent, status)}
				aria-labelledby={label !== undefined ? labelId : undefined}
				aria-label={label === undefined ? (ariaLabel ?? "进度") : undefined}
				data-status={status}
			>
				<i
					className="v-progress__fill"
					style={{ "--v-progress-value": percent / 100 } as CSSProperties}
				/>
			</div>
			{segments !== undefined && segments.count > 0 ? (
				<div className="v-progress__segments" aria-hidden="true">
					{Array.from({ length: segments.count }, (_, index) => (
						<i key={index} data-active={index < segments.active ? "" : undefined} />
					))}
				</div>
			) : null}
			{hint !== undefined ? (
				<p className="v-progress__hint" data-status={status}>
					{hint}
				</p>
			) : null}
		</div>
	);
}

/**
 * 知道百分比时的圆环进度：起点在正上方，顺时针；数字写在圆心。
 *
 * @remarks
 * 圆环用 `pathLength="100"` 归一化，`stroke-dashoffset` 过渡 300ms；
 * 减弱动态下直接跳到新值。名称与说明可以放在圆环右侧。
 */
export function ProgressRing({
	value,
	size = 48,
	label,
	description,
	status = "process",
	className,
	...props
}: ProgressRingProps) {
	const labelId = useId();
	const percent = Math.min(100, Math.max(0, value));
	const stroke = size === 48 ? 4 : 3;
	const radius = size === 48 ? 20 : 13;
	const { "aria-label": ariaLabel, ...rest } = props;
	return (
		<div data-slot="progress-ring" className={cn("v-progress-ring", className)} {...rest}>
			<span
				className="v-progress-ring__disc"
				data-size={size}
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(percent)}
				aria-valuetext={valueText(percent, status)}
				aria-labelledby={label !== undefined ? labelId : undefined}
				aria-label={label === undefined ? (ariaLabel ?? "进度") : undefined}
				data-status={status}
			>
				<svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
					<circle
						className="v-progress-ring__track"
						cx={size / 2}
						cy={size / 2}
						r={radius}
						strokeWidth={stroke}
					/>
					<circle
						className="v-progress-ring__fill"
						cx={size / 2}
						cy={size / 2}
						r={radius}
						strokeWidth={stroke}
						pathLength={100}
						strokeDasharray="100 100"
						style={{ strokeDashoffset: 100 - percent }}
					/>
				</svg>
				<span className="v-progress-ring__value">{`${Math.round(percent)}%`}</span>
			</span>
			{label !== undefined ? (
				<span className="v-progress-ring__text">
					<b id={labelId}>{label}</b>
					{description !== undefined ? <span>{description}</span> : null}
				</span>
			) : null}
		</div>
	);
}
