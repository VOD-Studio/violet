/**
 * InlineError - 内容区统一错误状态
 *
 * 操作失败/请求被拒在「内容区域」的标准呈现，与 Empty（空状态）同一版式
 * 语言：mono 签名 + hairline + 低饱和状态色（severity error 的 red 阶），
 * 无面板、无重色底——错误信息是内容的注脚，不是一块警报牌。
 *
 * 结构：左侧状态图标（severity error 配置）+ 错误消息（主文案）+
 * 可选详情 + 可选重试动作。取代散落的裸红色 <p>。
 *
 * 用法：
 * <InlineError message={err.message} onRetry={() => mutate()} />
 */
import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

export interface InlineErrorProps {
	/** 错误文案（必填；通常是后端 message 或业务错误描述） */
	message: string;
	/** 可选补充说明（如排查建议），弱化呈现 */
	detail?: ReactNode;
	/** 重试回调；提供时渲染行尾重试动作 */
	onRetry?: () => void;
	/** 重试按钮文案，默认「重试」 */
	retryLabel?: string;
	/** 重试进行中：动作禁用 */
	retrying?: boolean;
	/** 紧凑模式：单行内联（表单项下方等窄空间），默认标准块级 */
	inline?: boolean;
	className?: string;
}

export function InlineError({
	message,
	detail,
	onRetry,
	retryLabel = "重试",
	retrying = false,
	inline = false,
	className,
}: InlineErrorProps) {
	if (inline) {
		return (
			<p
				role="alert"
				className={cn(
					"flex items-center gap-2 font-mono text-xs text-red-600 dark:text-red-400",
					className,
				)}
			>
				<span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-red-500" />
				{message}
			</p>
		);
	}

	return (
		<div
			role="alert"
			className={cn(
				"flex items-start justify-between gap-4 border-b border-edge-hairline py-3",
				className,
			)}
		>
			<div className="flex min-w-0 items-start gap-2.5">
				<span
					aria-hidden="true"
					className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500 dark:bg-red-400"
				/>
				<div className="min-w-0">
					<p className="font-mono text-[13px] text-foreground">
						<span className="mr-2 tracking-[0.2em] text-red-600 uppercase dark:text-red-400">
							Error
						</span>
						{message}
					</p>
					{detail ? (
						<p className="text-muted-foreground mt-1 text-xs leading-relaxed">
							{detail}
						</p>
					) : null}
				</div>
			</div>
			{onRetry ? (
				<button
					type="button"
					onClick={onRetry}
					disabled={retrying}
					className="shrink-0 font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
				>
					{retrying ? "进行中…" : retryLabel}
				</button>
			) : null}
		</div>
	);
}

export default InlineError;
