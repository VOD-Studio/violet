import { SeasonGlyph } from "@shared/ui/icons";
import {
	type ChatEntry,
	MessageCenter,
	type MessageTab,
	MessageToast,
	type NoticeEntry,
} from "@shared/ui/message-panel";
import { NAVBAR_PILL_CLASS } from "@shared/ui/site-navbar";
import { Separator } from "@violet/ui";
import { cn } from "cn";
import { AtSign, Heart, Megaphone, MessageCircleReply, MessageSquareQuote } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { useScopeSeason } from "../../hooks/use-scope-season";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { portrait } from "./art";
import { StayLink } from "./stay-link";

const ICON_BUTTON =
	"flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

const NOTICES: NoticeEntry[] = [
	{
		id: "reply",
		icon: MessageCircleReply,
		actor: { name: "林间", avatar: portrait(20) },
		text: "回复了你的评论",
		quote: "好，晚上去翻。",
		time: "58 分钟前",
		unread: true,
		group: "today",
	},
	{
		id: "quote",
		icon: MessageSquareQuote,
		actor: { name: "Momo", avatar: portrait(330) },
		text: "引用了你的推文",
		quote: "这个落花太好看了，求教程！",
		time: "1 小时前",
		unread: true,
		group: "today",
	},
	{
		id: "announcement",
		icon: Megaphone,
		text: "新公告：评论编辑器即将支持 Markdown 实时预览",
		time: "昨天",
		unread: true,
		group: "earlier",
	},
	{
		id: "like",
		icon: Heart,
		actor: { name: "南山记", avatar: portrait(150) },
		text: "赞了你的手记",
		quote: "11 月 2 日 · 给博客加了季节",
		time: "前天",
		unread: false,
		group: "earlier",
	},
	{
		id: "mention",
		icon: AtSign,
		actor: { name: "Saber", avatar: portrait(260, "bot") },
		text: "在聊天室提到了你",
		quote: "@xunrua 摘要已经整理好了",
		time: "3 天前",
		unread: false,
		group: "earlier",
	},
];

const CHATS: ChatEntry[] = [
	{
		id: "claude",
		name: "Claude",
		avatar: portrait(260, "bot"),
		preview: "摘要已经整理好了，要我贴进手记吗？",
		time: "刚刚",
		unread: 1,
	},
	{
		id: "gpt",
		name: "GPT",
		avatar: portrait(170, "bot"),
		preview: "接口草稿发你了，看一眼命名",
		time: "5 分钟前",
		unread: 1,
	},
	{
		id: "gemini",
		name: "Gemini",
		avatar: portrait(40, "bot"),
		preview: "好的，周末见",
		time: "昨天",
		unread: 0,
	},
];

const ALERT = {
	conversationId: "claude",
	name: "Claude",
	avatar: portrait(260, "bot"),
	action: "在聊天室回复了你",
	preview: "摘要已经整理好了，要我贴进手记吗？",
};

function Article() {
	return (
		<div className="absolute inset-x-5 top-28 text-sm leading-7 text-muted-foreground">
			<div className="font-mono text-xs">2026-10-12 · 骑行</div>
			<div className="mt-1 text-2xl font-semibold text-foreground">独库公路，六天</div>
			<p className="mt-3">
				从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。
			</p>
		</div>
	);
}

function InboxStage({ initial }: { initial: "notice" | "chat" | "toast" }) {
	const { ref, container, host } = useStageContainer();
	const season = useScopeSeason(host);
	const [open, setOpen] = useState(initial !== "toast");
	const [tab, setTab] = useState<MessageTab>(initial === "chat" ? "chat" : "notice");
	const [unread, setUnread] = useState(
		() => new Set(NOTICES.filter((item) => item.unread).map((item) => item.id)),
	);
	const [seen, setSeen] = useState<Set<string>>(() => new Set());
	const [alert, setAlert] = useState(initial === "toast");
	const [push, setPush] = useState(false);

	const notices = NOTICES.map((item) => ({ ...item, unread: unread.has(item.id) }));
	const chats = CHATS.map((item) => (seen.has(item.id) ? { ...item, unread: 0 } : item));
	const chatUnread = chats.reduce((sum, item) => sum + item.unread, 0);

	return (
		<div ref={ref} className="relative size-full">
			<Article />
			<div
				className={cn(NAVBAR_PILL_CLASS, "absolute top-4 right-4 gap-0.5 p-1")}
				data-slot="navbar-right"
			>
				<div className="flex items-center gap-0.5">
					<button type="button" aria-label="季节与外观" className={ICON_BUTTON}>
						<SeasonGlyph season={season} className="size-4.5 text-decoration" />
					</button>
					<Separator orientation="vertical" className="h-4 bg-rule2" />
					<MessageCenter
						container={container}
						open={open}
						onOpenChange={setOpen}
						tab={tab}
						onTabChange={setTab}
						unread={unread.size + chatUnread}
						notices={notices}
						noticeUnread={unread.size}
						onSelectNotice={(id) =>
							setUnread((current) => new Set([...current].filter((x) => x !== id)))
						}
						onReadAll={() => setUnread(new Set())}
						push={{ checked: push, busy: false, onChange: setPush }}
						chat={{
							entries: chats,
							unread: chatUnread,
							onSelect: (id) => setSeen((current) => new Set(current).add(id)),
							LinkComponent: StayLink,
						}}
					/>
					<button type="button" aria-label="用户菜单" className={ICON_BUTTON}>
						<img
							src={portrait(200)}
							alt=""
							className="size-8 rounded-full object-cover"
						/>
					</button>
				</div>
			</div>
			<div role="status" className="pointer-events-none absolute top-17 right-4">
				<AnimatePresence>
					{alert ? (
						<MessageToast
							alert={ALERT}
							onReply={() => setAlert(false)}
							className="pointer-events-auto"
						/>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	);
}

function InboxSample({ state }: ExhibitRenderProps) {
	const initial = state === "chat" || state === "toast" ? state : "notice";
	return <InboxStage key={initial} initial={initial} />;
}

export const inboxExhibit: Exhibit = {
	id: "inbox",
	name: "消息面板",
	units: ["inbox"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 420, height: 620 },
	states: [
		{ id: "notice", label: "通知" },
		{ id: "chat", label: "聊天" },
		{ id: "toast", label: "新聊天消息" },
	],
	Render: InboxSample,
};
