import { Button, Empty, ScrollArea, Spinner } from "@violet/ui";
import { cn } from "cn";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import type { ConversationScrollState } from "../hooks/useConversationScroll";
import { MessageEmpty, MessageSkeleton } from "./chat-states";

interface ConversationMessageViewportProps {
	scroll: ConversationScrollState;
	backgroundClassName: string;
	empty: boolean;
	loading: {
		pending: boolean;
		failed: boolean;
		reload: () => void;
		hasNextPage: boolean;
		fetchingNext: boolean;
	};
	children: ReactNode;
}

/** 输入区不参与历史滚动，键盘和指针向上浏览时暂停追随新消息。 */
export function ConversationMessageViewport({
	scroll,
	backgroundClassName,
	empty,
	loading,
	children,
}: ConversationMessageViewportProps) {
	return (
		<>
			<ScrollArea
				ref={scroll.scrollContainerRef}
				data-testid="chat-message-list"
				tabIndex={0}
				role="region"
				aria-label="消息记录"
				onScroll={scroll.handleScroll}
				onPointerDownCapture={scroll.pauseFollow}
				onTouchStartCapture={scroll.pauseFollow}
				onWheelCapture={(event) => {
					if (event.deltaY < 0) {
						scroll.pauseFollow();
					}
				}}
				onKeyDownCapture={(event) => {
					if (
						event.key === "ArrowUp" ||
						event.key === "PageUp" ||
						event.key === "Home" ||
						(event.key === " " && event.shiftKey)
					) {
						scroll.pauseFollow();
					}
				}}
				className={cn(
					"min-h-0 flex-1 [--v-scroll-area-padding:1.25rem_var(--chat-gutter)_0]",
					backgroundClassName,
				)}
				viewportClassName="flex flex-col justify-end-safe"
			>
				<div className="w-full shrink-0 space-y-3 pb-4">
					{!empty && loading.hasNextPage && (
						<div
							ref={scroll.topSentinelRef}
							data-testid="chat-load-older-sentinel"
							className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
						>
							{loading.fetchingNext && (
								<>
									<Spinner size={16} aria-hidden="true" />
									加载更早的消息…
								</>
							)}
						</div>
					)}
					{loading.failed && empty ? (
						<Empty
							variant="plain"
							title="消息加载失败"
							description="可以重新加载，草稿不会清空。"
							action={<Button onClick={loading.reload}>重新加载消息</Button>}
						/>
					) : loading.pending && empty ? (
						<MessageSkeleton />
					) : empty ? (
						<MessageEmpty />
					) : (
						children
					)}
				</div>
			</ScrollArea>
			{scroll.showScrollBottom && (
				<div className="pointer-events-none absolute bottom-24 right-4 z-10">
					<Button
						aria-label="回到底部"
						className="pointer-events-auto border border-border bg-card shadow-soft"
						onClick={() => scroll.scrollToBottom(true)}
						iconOnly
						size="sm"
						variant="outline"
					>
						<ArrowDown className="size-4" />
					</Button>
				</div>
			)}
		</>
	);
}
