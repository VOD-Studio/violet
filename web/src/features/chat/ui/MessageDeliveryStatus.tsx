import { getClientThemeState } from "@shared/lib/theme-preference";
import { FlowerBloom, SEASON_FLOWER } from "@violet/ui";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import type { OutgoingMessage } from "../model/chat-outbox";

/** 尚未确认的消息显示上传或失败状态，重试仍复用原草稿和幂等键。 */
export interface MessageDeliveryStatusProps {
	sending: Pick<OutgoingMessage, "status" | "progress" | "error">;
	onRetry?: () => void;
}

export function MessageDeliveryStatus({ sending, onRetry }: MessageDeliveryStatusProps) {
	return (
		<div
			className={cn(
				"flex max-w-full items-center text-[11px] leading-4 text-muted-foreground",
				sending.status === "failed" ? "gap-1" : "flex-col gap-0.5",
			)}
			role="status"
			aria-live="polite"
			aria-busy={sending.status !== "failed" || undefined}
		>
			{sending.status === "failed" ? (
				<>
					<TriangleAlert
						className="size-3.5 shrink-0 text-destructive"
						aria-hidden="true"
					/>
					<span className="text-destructive wrap-anywhere">{sending.error}</span>
					<button
						type="button"
						className="shrink-0 rounded text-selected-foreground underline focus-visible:outline-2 focus-visible:outline-ring"
						onClick={onRetry}
					>
						重试
					</button>
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
