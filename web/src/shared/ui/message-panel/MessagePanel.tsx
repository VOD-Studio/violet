import {
	Button,
	Empty,
	ListHighlight,
	ListHighlightItem,
	Skeleton,
	Switch,
	Tabs,
	TabsContent,
	TabsCount,
	TabsList,
	TabsTrigger,
} from "@violet/ui";
import { cn } from "cn";
import { ArrowRight, CheckCheck } from "lucide-react";
import { type ComponentProps, type ComponentType, useEffect, useId, useState } from "react";
import { ChatRow } from "./ChatRow";
import type { ListStatus } from "./list-status";
import { NoticeRow } from "./NoticeRow";
import type { ChatEntry, MessageTab, NoticeEntry } from "./types";

/** 面板里的链接渲染契约：普通锚点属性加 `href`，`ref` 与其余属性透传。 */
export type MessageLinkComponent = ComponentType<ComponentProps<"a"> & { href: string }>;

const DefaultLink: MessageLinkComponent = ({ href, ...props }) => <a href={href} {...props} />;

/** 聊天标签的数据与动作。 */
export interface MessagePanelChat {
	entries: ChatEntry[];
	/** 全部会话的未读条数之和，显示在标签旁。 */
	unread: number;
	/** @default "ready" */
	status?: ListStatus;
	onSelect: (id: string) => void;
	onRetry?: () => void;
	/** 「进入聊天室」用的链接组件，默认原生锚点。 */
	LinkComponent?: MessageLinkComponent;
}

/** 消息面板的内容：数据与动作全由调用方给出，面板不取数据、不认识通知类型。 */
export interface MessagePanelProps {
	tab: MessageTab;
	onTabChange: (tab: MessageTab) => void;
	notices: NoticeEntry[];
	/** 服务端统计的未读数，可能多于已加载的行。 */
	noticeUnread: number;
	/** @default "ready" */
	status?: ListStatus;
	onRetry?: () => void;
	onSelectNotice: (id: string) => void;
	onReadAll: () => void;
	/** 浏览器推送开关；省略表示当前环境不支持，不占位。 */
	push?: { checked: boolean; busy: boolean; onChange: (checked: boolean) => void };
	/** 聊天标签；省略时面板只有通知，不出现标签（后台顶栏）。 */
	chat?: MessagePanelChat;
}

const SCROLLER = "max-h-96 overflow-y-auto overscroll-contain";

function Placeholder({ rows }: { rows: number }) {
	return (
		<div aria-busy="true" className="flex flex-col gap-0.5">
			{Array.from({ length: rows }, (_, index) => (
				// 占位行数固定、没有重排，下标足够区分
				<div key={index} className="flex items-center gap-3 px-3 py-2.5">
					<Skeleton className="size-9 rounded-full" />
					<div className="flex flex-1 flex-col gap-1.5">
						<Skeleton className="h-3.5 w-3/4 rounded-full" />
						<Skeleton className="h-3 w-1/2 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}

function Failure({ title, onRetry }: { title: string; onRetry?: () => void }) {
	return (
		<Empty
			variant="compact"
			title={title}
			action={
				onRetry ? (
					<Button variant="ghost" size="sm" onClick={onRetry}>
						重试
					</Button>
				) : undefined
			}
		/>
	);
}

function NoticeList({
	notices,
	status,
	onRetry,
	onSelect,
}: {
	notices: NoticeEntry[];
	status: ListStatus;
	onRetry?: () => void;
	onSelect: (id: string) => void;
}) {
	if (status === "loading") return <Placeholder rows={3} />;
	if (status === "error") return <Failure title="通知加载失败" onRetry={onRetry} />;
	if (notices.length === 0) return <Empty variant="compact" title="暂无通知" />;

	const groups = [
		{ id: "today", label: "今天" },
		{ id: "earlier", label: "更早" },
	].map((group) => ({ ...group, items: notices.filter((n) => n.group === group.id) }));

	return (
		<ListHighlight>
			<div className={SCROLLER}>
				{groups
					.filter((group) => group.items.length > 0)
					.map((group) => (
						<div key={group.id} role="group" aria-label={group.label}>
							<div
								aria-hidden="true"
								className="px-3 pt-3 pb-1 text-12 text-muted-foreground"
							>
								{group.label}
							</div>
							<div className="flex flex-col gap-0.5">
								{group.items.map((notice) => (
									<ListHighlightItem key={notice.id}>
										<NoticeRow
											notice={notice}
											onSelect={() => onSelect(notice.id)}
										/>
									</ListHighlightItem>
								))}
							</div>
						</div>
					))}
			</div>
		</ListHighlight>
	);
}

function ChatList({ chat }: { chat: MessagePanelChat }) {
	const { entries, status = "ready", onRetry, onSelect, LinkComponent = DefaultLink } = chat;
	if (status === "loading") return <Placeholder rows={3} />;
	if (status === "error") return <Failure title="会话加载失败" onRetry={onRetry} />;
	return (
		<>
			{entries.length === 0 ? (
				<Empty variant="compact" title="还没有会话" />
			) : (
				<ListHighlight>
					<div className={cn(SCROLLER, "flex flex-col gap-0.5")}>
						{entries.map((entry) => (
							<ListHighlightItem key={entry.id}>
								<ChatRow entry={entry} onSelect={() => onSelect(entry.id)} />
							</ListHighlightItem>
						))}
					</div>
				</ListHighlight>
			)}
			<Button asChild variant="secondary" className="mt-1.5 w-full rounded-[10px] text-13">
				<LinkComponent href="/chat">
					进入聊天室
					<ArrowRight aria-hidden="true" className="size-3.5" />
				</LinkComponent>
			</Button>
		</>
	);
}

function PushRow({ push }: { push: NonNullable<MessagePanelProps["push"]> }) {
	const labelId = useId();
	return (
		<div className="mt-1.5 flex items-center justify-between gap-3 border-t border-border px-3 pt-2.5 pb-1 text-13 text-muted-foreground">
			<span id={labelId}>浏览器通知</span>
			<Switch
				size="sm"
				aria-labelledby={labelId}
				checked={push.checked}
				loading={push.busy}
				onCheckedChange={push.onChange}
			/>
		</div>
	);
}

/** 通知与聊天两个标签；没有 `chat` 时只有通知，标题代替标签。 */
export function MessagePanel({
	tab,
	onTabChange,
	notices,
	noticeUnread,
	status = "ready",
	onRetry,
	onSelectNotice,
	onReadAll,
	push,
	chat,
}: MessagePanelProps) {
	const [announced, setAnnounced] = useState(false);
	// 又有新的未读时，上一次「已全部标为已读」的播报作废
	useEffect(() => {
		if (noticeUnread > 0) setAnnounced(false);
	}, [noticeUnread]);

	const readAll = (
		<Button
			iconOnly
			variant="ghost"
			size="sm"
			aria-label="全部标为已读"
			disabled={noticeUnread === 0}
			onClick={() => {
				onReadAll();
				setAnnounced(true);
			}}
		>
			<CheckCheck aria-hidden="true" />
		</Button>
	);
	const noticeBody = (
		<>
			<NoticeList
				notices={notices}
				status={status}
				onRetry={onRetry}
				onSelect={onSelectNotice}
			/>
			{push ? <PushRow push={push} /> : null}
		</>
	);

	return (
		<div data-slot="message-panel">
			<span role="status" className="sr-only">
				{announced ? "已全部标为已读" : ""}
			</span>
			{chat ? (
				<Tabs value={tab} onValueChange={(next) => onTabChange(next as MessageTab)}>
					<div className="flex items-center justify-between gap-2 pr-1 pl-2">
						<TabsList aria-label="消息分类">
							<TabsTrigger value="notice">
								通知
								{noticeUnread > 0 ? <TabsCount>{noticeUnread}</TabsCount> : null}
							</TabsTrigger>
							<TabsTrigger value="chat">
								聊天
								{chat.unread > 0 ? <TabsCount>{chat.unread}</TabsCount> : null}
							</TabsTrigger>
						</TabsList>
						{tab === "notice" ? readAll : null}
					</div>
					<TabsContent value="notice" className="mt-1">
						{noticeBody}
					</TabsContent>
					<TabsContent value="chat" className="mt-1">
						<ChatList chat={chat} />
					</TabsContent>
				</Tabs>
			) : (
				<>
					<div className="flex h-10 items-center justify-between gap-2 pr-1 pl-3">
						<h2 className="m-0 text-14 font-semibold">通知</h2>
						{readAll}
					</div>
					<div className="mt-1">{noticeBody}</div>
				</>
			)}
		</div>
	);
}
