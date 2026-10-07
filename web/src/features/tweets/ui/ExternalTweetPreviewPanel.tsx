import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { Input } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { useId } from "react";
import type { ExternalTweetPreviewState } from "../hooks/useExternalTweetPreview";
import cardStyles from "./TweetCard.module.css";
import styles from "./TweetComposer.module.css";

/** 发布器持有的原文获取状态与发布锁。 */
export interface ExternalTweetPreviewPanelProps {
	state: ExternalTweetPreviewState;
	disabled: boolean;
}

/** 粘贴链接后显示准备状态、原文卡片及发布时效。 */
export function ExternalTweetPreviewPanel({ state, disabled }: ExternalTweetPreviewPanelProps) {
	const inputId = useId();
	const preview = state.preview;
	if (preview) {
		return (
			<section aria-label="X 转发预览" className="space-y-3">
				<div className={cardStyles.references}>
					<ExternalTweetCard tweet={preview.external_tweet} />
				</div>
				{(preview.warnings ?? []).length > 0 && (
					<p className="text-xs text-muted-foreground">{preview.warnings?.join("；")}</p>
				)}
				{state.expired && (
					<div className="flex items-center justify-between gap-3">
						<p role="alert" className="text-xs text-destructive">
							预览已过期，请重新预览后确认。
						</p>
						<button
							type="button"
							className={styles.action}
							disabled={disabled || state.loading}
							onClick={() => void state.load()}
						>
							重新预览
						</button>
					</div>
				)}
			</section>
		);
	}
	return (
		<section aria-label="X 转发预览" className="space-y-3">
			<label htmlFor={inputId} className="sr-only">
				X 推文链接
			</label>
			<div className="flex items-center gap-2">
				<Input
					id={inputId}
					type="url"
					maxLength={2048}
					value={state.url}
					onChange={(e) => state.setUrl(e.target.value)}
					disabled={disabled}
					placeholder="粘贴 X 推文链接"
					className="h-11 min-w-0 flex-1 rounded-lg"
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.nativeEvent.isComposing) {
							e.preventDefault();
							if (!disabled && !state.loading) void state.load();
						}
					}}
				/>
				<button
					type="button"
					aria-label="预览原文"
					aria-busy={state.loading}
					className={styles.action}
					disabled={disabled || state.loading || !state.url.trim()}
					onClick={() => void state.load()}
				>
					{state.loading && <Loader2 className="size-3 animate-spin" />}
					{state.loading ? "获取中…" : "预览"}
				</button>
			</div>
			{state.loading && (
				<p role="status" className="text-xs text-muted-foreground">
					正在获取原文并保存图片…
				</p>
			)}
			{state.error && (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			)}
		</section>
	);
}
