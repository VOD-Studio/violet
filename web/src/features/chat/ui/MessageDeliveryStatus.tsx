import { getClientThemeState } from "@shared/lib/theme-preference";
import {
	Button,
	FlowerBloom,
	SEASON_FLOWER,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@violet/ui";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import type { OutgoingMessage } from "../model/chat-outbox";

/** 尚未确认的消息显示上传或失败状态，重试仍复用原草稿和幂等键。 */
export interface MessageDeliveryStatusProps {
	sending: Pick<OutgoingMessage, "status" | "progress" | "error">;
	onRetry?: () => void;
}

export function MessageDeliveryStatus({ sending, onRetry }: MessageDeliveryStatusProps) {
	const reasonID = useId();
	const reason = sending.error ?? "消息发送失败，请稍后重试";
	return (
		<div
			className={cn(
				"flex min-h-5 max-w-full items-center text-[11px] leading-4 text-muted-foreground",
				sending.status === "failed" ? "gap-1" : "flex-col gap-0.5",
			)}
			role="status"
			aria-live="polite"
			aria-busy={sending.status !== "failed" || undefined}
		>
			{sending.status === "failed" ? (
				<>
					<span id={reasonID} className="sr-only">
						{reason}
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-5 shrink-0 gap-1 px-1 text-[11px] text-destructive"
								aria-label={onRetry ? "重试" : "查看发送失败原因"}
								aria-describedby={reasonID}
								onClick={onRetry}
							>
								<TriangleAlert className="size-3.5" aria-hidden="true" />
								{onRetry && "重试"}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{reason}</TooltipContent>
					</Tooltip>
				</>
			) : (
				<>
					<FlowerBloom
						kind={SEASON_FLOWER[getClientThemeState().preset]}
						size={20}
						variant="solid"
						tone="season"
						aria-hidden="true"
					/>
					{sending.status === "uploading" && (
						<span aria-hidden="true">{sending.progress}%</span>
					)}
					<span className="sr-only">
						{sending.status === "uploading"
							? `图片上传中 ${sending.progress}%`
							: "发送中"}
					</span>
				</>
			)}
		</div>
	);
}
