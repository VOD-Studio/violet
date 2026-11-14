import { Spinner } from "@violet/ui";
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
			className="flex max-w-full items-center gap-1 text-[11px] leading-4 text-muted-foreground"
			role="status"
			aria-live="polite"
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
					<Spinner size={16} aria-hidden="true" />
					<span>
						{sending.status === "uploading"
							? `图片上传中 ${sending.progress}%`
							: "发送中"}
					</span>
				</>
			)}
		</div>
	);
}
