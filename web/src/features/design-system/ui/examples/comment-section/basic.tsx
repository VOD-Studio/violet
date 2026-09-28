import { CommentList, CommentSection, type CommentSectionConfig } from "@shared/ui/comment-section";
import { Heart, Send } from "lucide-react";
import { useState } from "react";
import { BASIC_COMMENTS, type DemoComment } from "./shared";

/** 评论基础用法：双层扁平回复结构与可交互点赞。 */
export function CommentSectionBasicDemo() {
	const [comments] = useState<DemoComment[]>(BASIC_COMMENTS);
	const [likes, setLikes] = useState<Record<string, number>>({ "c-1": 12, "c-1-1": 3, "c-2": 5 });
	const [hasLiked, setHasLiked] = useState<Record<string, boolean>>({ "c-1": true });

	const handleToggleLike = (id: string) => {
		setHasLiked((prev) => {
			const active = !prev[id];
			setLikes((curr) => ({
				...curr,
				[id]: (curr[id] ?? 0) + (active ? 1 : -1),
			}));
			return { ...prev, [id]: active };
		});
	};

	const config: CommentSectionConfig<DemoComment> = {
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
			const isLiked = Boolean(hasLiked[item.id]);
			const count = likes[item.id] ?? 0;
			return (
				<button
					type="button"
					onClick={() => handleToggleLike(item.id)}
					className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs transition-colors ${
						isLiked
							? "bg-destructive/10 text-destructive"
							: "text-muted-foreground hover:bg-muted hover:text-foreground"
					}`}
				>
					<Heart className={`size-3 ${isLiked ? "fill-current" : ""}`} />
					<span className="tabular-nums font-mono">{count}</span>
				</button>
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

	return (
		<CommentSection title={`全部评论 (${comments.length})`} form={null} isLoggedIn={true}>
			<CommentList comments={comments} config={config} isLoggedIn={true} />
		</CommentSection>
	);
}
