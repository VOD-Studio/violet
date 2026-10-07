import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { Input } from "@violet/ui";
import { Loader2, X } from "lucide-react";
import { useId } from "react";
import type { ExternalTweetPreviewState } from "../hooks/useExternalTweetPreview";
import cardStyles from "./TweetCard.module.css";
import styles from "./TweetComposer.module.css";

/** 发布器持有预览状态，取消仅移除外部来源。 */
export interface ExternalTweetPreviewPanelProps {
	state: ExternalTweetPreviewState;
	disabled: boolean;
	onCancel: () => void;
}

/** 粘贴链接后显示准备状态、原文卡片及发布时效。 */
export function ExternalTweetPreviewPanel({
	state,
	disabled,
	onCancel,
}: ExternalTweetPreviewPanelProps) {
	const inputId = useId();
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
					className="h-9 min-w-0 flex-1"
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
				<button
					type="button"
					aria-label="取消 X 转发"
					className={styles.action}
					disabled={disabled}
					onClick={onCancel}
				>
					<X className="size-4" />
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
			{state.preview && (
				<>
					<div className={cardStyles.references}>
						<ExternalTweetCard tweet={state.preview.external_tweet} />
					</div>
					{(state.preview.warnings ?? []).length > 0 && (
						<p className="text-xs text-muted-foreground">
							{state.preview.warnings?.join("；")}
						</p>
					)}
					{state.expired && (
						<p role="alert" className="text-xs text-destructive">
							预览已过期，请重新预览后确认。
						</p>
					)}
				</>
			)}
		</section>
	);
}
