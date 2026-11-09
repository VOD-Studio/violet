import { Avatar, Button } from "@violet/ui";
import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";
import type { ChatAlertEntry } from "./types";

export interface MessageToastProps {
	alert: ChatAlertEntry;
	/** 点「回复」：由调用方进入该会话并收起提示。 */
	onReply: () => void;
	/** 指针悬停或焦点停在提示上时暂停自动收起。 */
	onPauseChange?: (paused: boolean) => void;
	className?: string;
}

/**
 * 新聊天消息的轻提示：头像、谁做了什么、一行预览，右边一个「回复」。
 *
 * 只淡入淡出，不位移；定位与自动收起由调用方负责，放进 `AnimatePresence` 即得退场淡出。
 * 不带 live region：读屏播报要靠一个先于提示挂载的 `role="status"` 容器，由调用方提供。
 */
export function MessageToast({ alert, onReply, onPauseChange, className }: MessageToastProps) {
	const reduced = useReducedMotion();
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1, transition: { duration: reduced ? 0.1 : 0.2 } }}
			exit={{ opacity: 0, transition: { duration: reduced ? 0.1 : 0.14 } }}
			onPointerEnter={() => onPauseChange?.(true)}
			onPointerLeave={() => onPauseChange?.(false)}
			onFocusCapture={() => onPauseChange?.(true)}
			onBlurCapture={() => onPauseChange?.(false)}
			className={cn(
				"flex w-85 max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-[14px] border border-sheet-border bg-popover py-3 pr-3 pl-3.5 text-popover-foreground shadow-soft",
				className,
			)}
		>
			<Avatar size={32} name={alert.name} src={alert.avatar} alt="" />
			<span className="min-w-0 flex-1 text-13 leading-normal">
				<b className="font-semibold">{alert.name}</b> {alert.action}
				<span className="block truncate text-12 text-muted-foreground">
					{alert.preview}
				</span>
			</span>
			<Button variant="secondary" size="sm" onClick={onReply} className="shrink-0">
				回复
			</Button>
		</motion.div>
	);
}
