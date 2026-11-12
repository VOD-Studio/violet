import {
	Avatar,
	CommentHeader,
	CommentItem,
	CommentList,
	CommentReplies,
	type CommentSort,
	ReactionBar,
} from "@violet/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import {
	changeReaction,
	createComments,
	type DemoComment,
	ReplyComposer,
	updateComment,
} from "./comment-data";
import { REACTION_CHOICES } from "./reaction-data";

const RECENT = REACTION_CHOICES.slice(0, 4);

function CommentScene({ state }: ExhibitRenderProps) {
	const [comments, setComments] = useState(() => createComments(state));
	const [sort, setSort] = useState<CommentSort>(state === "hot" ? "hot" : "latest");
	const [replyId, setReplyId] = useState<string | null>(state === "reply-open" ? "latest" : null);
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	const sequence = useRef(10);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const visitor = state === "visitor";
	const title = state === "tweet" ? "推文讨论" : "文章评论";
	const ordered = [...comments].sort((left, right) => {
		if (sort === "hot") {
			const difference =
				right.reactions.reduce((sum, reaction) => sum + reaction.count, 0) -
				left.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
			if (difference !== 0) {
				return difference;
			}
		}
		return right.created - left.created;
	});

	const react = (item: DemoComment, id: string, add: boolean) => {
		if (busy) {
			return;
		}
		const next = changeReaction(item.reactions, id, add);
		if (next === item.reactions) {
			return;
		}
		setComments((current) =>
			updateComment(current, item.id, (entry) => ({ ...entry, reactions: next })),
		);
		setNotice("");
		if (state === "rollback") {
			setBusy(true);
			timer.current = window.setTimeout(() => {
				setComments((current) =>
					updateComment(current, item.id, (entry) => ({
						...entry,
						reactions: item.reactions,
					})),
				);
				setBusy(false);
				setNotice("回应没有成功，已恢复原来的表情与人数。");
			}, 420);
		}
	};

	const submit = (target: DemoComment, rootId: string, body: string) => {
		sequence.current += 1;
		const reply: DemoComment = {
			id: `local-${sequence.current}`,
			author: "本机用户",
			body,
			created: sequence.current,
			replyTo: target.author,
			reactions: [],
			replies: [],
		};
		setComments((current) =>
			updateComment(current, rootId, (entry) => ({
				...entry,
				replies: [...entry.replies, reply],
			})),
		);
		setReplyId(null);
		setNotice(`已回复 @${target.author}`);
	};

	const renderItem = (item: DemoComment, rootId: string, index = 0): ReactNode => {
		const isReply = item.id !== rootId;
		const toggleReply = () => setReplyId((current) => (current === item.id ? null : item.id));
		let replyForm: ReactNode;
		if (replyId === item.id) {
			replyForm = (
				<ReplyComposer
					key={item.id}
					author={item.author}
					onSubmit={(body) => submit(item, rootId, body)}
				/>
			);
		}
		let replies: ReactNode;
		if (item.replies.length > 0) {
			replies = (
				<CommentReplies aria-label={`${item.author}的回复`}>
					{item.replies.map((reply, replyIndex) => renderItem(reply, rootId, replyIndex))}
				</CommentReplies>
			);
		}
		return (
			<li key={item.id}>
				<CommentItem
					author={item.author}
					avatar={<Avatar name={item.author} alt="" />}
					dateTime={new Date(Date.UTC(2026, 10, 12, 1, item.created)).toISOString()}
					time={`${item.created} 分钟前`}
					isAuthor={item.isAuthor}
					reply={isReply}
					replyTo={item.replyTo}
					status={item.status}
					enterDelay={isReply ? index * 40 : 0}
					onReply={visitor ? undefined : toggleReply}
					replyForm={replyForm}
					replies={replies}
					actions={
						<ReactionBar
							items={item.reactions}
							recentItems={RECENT}
							disabled={busy}
							onToggle={visitor ? undefined : (id) => react(item, id, false)}
							onAdd={visitor ? undefined : (id) => react(item, id, true)}
						/>
					}
				>
					{item.body}
				</CommentItem>
			</li>
		);
	};

	return (
		<section className="w-full p-4" aria-label={title}>
			<CommentHeader
				title={<h2>{title}</h2>}
				count={comments.length}
				sort={sort}
				onSortChange={setSort}
			/>
			<CommentList aria-label={title}>
				{ordered.map((item) => renderItem(item, item.id))}
			</CommentList>
			<p role="status" className="mt-3 min-h-5 text-xs text-muted-foreground">
				{visitor ? "访客可以阅读讨论与回应名单，登录后才能回复或回应。" : notice}
			</p>
		</section>
	);
}

function Comments({ state }: ExhibitRenderProps) {
	return <CommentScene key={state} state={state} />;
}

/** 同一评论壳承载文章、推文、审核状态与受控回复，不引入业务数据依赖。 */
export const commentExhibit: Exhibit = {
	id: "comment",
	name: "评论",
	units: ["comment", "reaction"],
	zone: "content",
	category: "content",
	footprint: { width: 600, height: 620 },
	states: [
		{ id: "article", label: "文章与作者回复" },
		{ id: "tweet", label: "推文共用评论壳" },
		{ id: "reply-open", label: "打开回复与焦点" },
		{ id: "hot", label: "按回应热度排序" },
		{ id: "moderation", label: "待审核与已删除" },
		{ id: "visitor", label: "匿名只读" },
		{ id: "long", label: "长内容与链接" },
		{ id: "rollback", label: "回应失败回滚" },
	],
	Render: Comments,
};
