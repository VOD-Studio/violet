/**
 * 空态与骨架屏：无选中会话、会话列表空、消息空与加载占位。
 */

import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Image as ImageIcon, MessageCircle, Plus } from "lucide-react";

export function EmptyConversation({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="max-w-sm text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
					<MessageCircle className="size-5" />
				</div>
				<h2 className="mt-4 text-base font-semibold text-foreground">选择一个会话</h2>
				<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
					从左侧选择私聊或群聊，或直接新建一个对话。
				</p>
				<div className="mt-5 flex justify-center">
					<Button onClick={onCreate} size="sm">
						<Plus className="size-4" />
						新建会话
					</Button>
				</div>
			</div>
		</div>
	);
}

export function ConversationEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="px-4 py-10 text-center">
			<MessageCircle className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-2.5 text-xs font-medium">还没有会话</p>
			<p className="mt-0.5 text-xs text-muted-foreground">发起一次私聊即可建立连接。</p>
			<Button
				className="mt-3.5 h-8 px-3 text-xs"
				onClick={onCreate}
				size="sm"
				variant="outline"
			>
				<Plus className="mr-1 size-3.5" />
				新建会话
			</Button>
		</div>
	);
}

export function ConversationSkeleton() {
	return (
		<div className="space-y-2 px-1 py-1">
			{Array.from({ length: 5 }, (_, index) => (
				<div className="flex items-center gap-3 p-2" key={index}>
					<div className="size-9 animate-pulse rounded-full bg-secondary/80" />
					<div className="flex-1 space-y-1.5">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary/80" />
						<div className="h-2 w-1/2 animate-pulse rounded bg-secondary/60" />
					</div>
				</div>
			))}
		</div>
	);
}

export function MessageSkeleton() {
	return (
		<div className="space-y-5">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					className={cn("flex gap-3", index % 2 === 1 && "flex-row-reverse")}
					key={index}
				>
					<div className="size-8 animate-pulse rounded-full bg-secondary/80" />
					<div className="h-12 w-1/2 animate-pulse rounded-2xl bg-secondary/60" />
				</div>
			))}
		</div>
	);
}

export function MessageEmpty() {
	return (
		<div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
			<ImageIcon className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-2.5 text-sm font-medium text-foreground">这是新的会话</p>
			<p className="mt-1 text-xs text-muted-foreground">发送第一条消息或图片，开始对话。</p>
		</div>
	);
}
