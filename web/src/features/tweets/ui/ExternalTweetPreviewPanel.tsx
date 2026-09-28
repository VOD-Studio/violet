import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { Button, Input } from "@violet/ui";
import { Loader2, X } from "lucide-react";
import { useId } from "react";
import type { useExternalTweetPreview } from "../hooks/useExternalTweetPreview";

/** 发布器持有预览状态，取消仅移除外部来源。 */
export interface ExternalTweetPreviewPanelProps {
	state: ReturnType<typeof useExternalTweetPreview>;
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
		<section
			aria-label="X 转发预览"
			className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3"
		>
			<div className="flex items-center justify-between gap-2">
				<label htmlFor={inputId} className="text-sm font-medium">
					转发 X 推文
				</label>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label="取消 X 转发"
					disabled={disabled}
					onClick={onCancel}
					className="size-8"
				>
					<X className="size-4" />
				</Button>
			</div>
			<div className="flex flex-wrap gap-2">
				<Input
					id={inputId}
					type="url"
					maxLength={2048}
					value={state.url}
					onChange={(e) => state.setUrl(e.target.value)}
					disabled={disabled}
					placeholder="https://x.com/用户名/status/推文ID"
					className="min-w-0 flex-1 basis-48"
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							void state.load();
						}
					}}
				/>
				<Button
					type="button"
					variant="secondary"
					disabled={disabled || state.loading || !state.url.trim()}
					onClick={() => void state.load()}
				>
					{state.loading && <Loader2 className="size-4 animate-spin" />}预览原文
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				使用公开原文，无需绑定 X 账号。可在上方填写转发感想。
			</p>
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
					<ExternalTweetCard tweet={state.preview.external_tweet} />
					{(state.preview.warnings ?? []).length > 0 && (
						<p className="text-xs text-muted-foreground">
							{state.preview.warnings?.join("；")}
						</p>
					)}
					<p
						role={state.expired ? "alert" : undefined}
						className={`text-xs ${state.expired ? "text-destructive" : "text-muted-foreground"}`}
					>
						{state.expired
							? "预览已过期，请重新预览后确认。"
							: "原文已准备好，确认后发布为本站推文。"}
					</p>
				</>
			)}
		</section>
	);
}
