import type { CommentSectionConfig } from "@shared/ui/comment-section";
import { Heart, Send } from "lucide-react";

export interface DemoComment {
	id: string;
	user: string;
	text: string;
	time: string;
	role?: "author";
	likes: number;
	parentId?: string;
	repliesCount?: number;
	previewList?: DemoComment[];
}

export const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const BASIC_COMMENTS: DemoComment[] = [
	{
		id: "c-1",
		user: "DefectingCat",
		role: "author",
		text: "展示层与数据层解耦后，文章评论和推文评论共用同一套交互逻辑；正文、操作与回复表单均通过插槽注入。",
		time: hoursAgo(3),
		likes: 12,
		repliesCount: 1,
		previewList: [
			{
				id: "c-1-1",
				parentId: "c-1",
				user: "Lin",
				text: "双层扁平回复结构配合 @ 昵称标注，在移动端不会发生多层级挤压。",
				time: hoursAgo(2),
				likes: 3,
			},
		],
	},
	{
		id: "c-2",
		user: "Kite",
		text: "业务方只需提供一个 CommentSectionConfig 适配器即可完成接入。",
		time: hoursAgo(1),
		likes: 5,
		repliesCount: 0,
		previewList: [],
	},
];

/** 静态展示用适配器：点赞为数据快照，无交互 state。 */
export const demoConfig: CommentSectionConfig<DemoComment> = {
	repliesMode: "preview",
	map: (raw) => ({
		id: raw.id,
		depth: raw.parentId ? 1 : 0,
		parentId: raw.parentId,
		replyToName: raw.parentId ? "DefectingCat" : undefined,
		authorName: raw.user,
		isAuthor: raw.role === "author",
		body: raw.text,
		createdAt: raw.time,
		tone: raw.role === "author" ? "author" : "default",
		repliesTotal: raw.repliesCount ?? raw.previewList?.length ?? 0,
		repliesPreview: raw.previewList,
		raw,
	}),
	renderActions: (item) => {
		const isLiked = item.id === "c-1";
		const count = item.raw.likes;
		return (
			<span
				className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs ${
					isLiked ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
				}`}
			>
				<Heart className={`size-3 ${isLiked ? "fill-current" : ""}`} />
				<span className="tabular-nums font-mono">{count}</span>
			</span>
		);
	},
	renderReplyForm: (item) => (
		<div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-background/60 p-3 font-sans">
			<div className="text-xs text-muted-foreground">回复给 @{item.authorName}</div>
			<textarea
				rows={2}
				placeholder="写下善意的回复..."
				className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus-visible:border-ring"
			/>
			<div className="flex justify-end">
				<button
					type="button"
					className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
				>
					<Send className="size-3" />
					<span>发送</span>
				</button>
			</div>
		</div>
	),
	renderExpandedReplies: ({ knownReplies }) => (
		<ul className="space-y-2 pt-1 font-sans">
			{knownReplies.map((reply) => (
				<li
					key={reply.id}
					className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs"
				>
					<span className="font-medium text-foreground">{reply.authorName}</span>
					<p className="mt-1 text-muted-foreground">{reply.body}</p>
				</li>
			))}
		</ul>
	),
};
