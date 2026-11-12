import { Button, type CommentStatus, type ReactionItem, Textarea } from "@violet/ui";
import { useState } from "react";
import { createDemoReaction, REACTION_CHOICES_BY_ID } from "./reaction-data";

export interface DemoComment {
	id: string;
	author: string;
	body: string;
	created: number;
	isAuthor?: boolean;
	replyTo?: string;
	status?: CommentStatus;
	reactions: ReactionItem[];
	replies: DemoComment[];
}

function reactions(count: number): ReactionItem[] {
	return ["heart", "think", "clap"].flatMap((id, index) => {
		const choice = REACTION_CHOICES_BY_ID.get(id);
		if (!choice) {
			return [];
		}
		return [createDemoReaction(choice, count - index, false)];
	});
}

export function createComments(state: string): DemoComment[] {
	const author: DemoComment = {
		id: "author",
		author: "林间",
		body: "把留白留给读者，也把回应留在文字旁边。",
		created: 1,
		isAuthor: true,
		reactions: reactions(8),
		replies: [
			{
				id: "reply",
				author: "雾里",
				body: "这句我记下了，谢谢分享。",
				created: 3,
				replyTo: "林间",
				reactions: reactions(3),
				replies: [],
			},
		],
	};
	const latest: DemoComment = {
		id: "latest",
		author: "山野",
		body: "雨停了，正好再读一遍。",
		created: 2,
		reactions: reactions(3),
		replies: [],
	};
	if (state === "moderation") {
		return [
			{ ...latest, status: "pending", body: "补充一个观察，等审核后和大家交流。" },
			{ ...author, status: "deleted", replies: [] },
		];
	}
	if (state === "long") {
		return [
			{
				...author,
				author: "一个名字很长但仍然需要完整显示的读者",
				isAuthor: false,
				body: "窄屏里，长名字、长段落和链接都应自然换行。\n读到这里时，我想起雨后山间的风：不急着给出结论，而是留一点时间，让问题慢慢展开。\nhttps://example.com/a-deliberately-long-unbroken-comment-reference-for-small-screens",
				replies: [],
			},
		];
	}
	return [latest, author];
}

export function changeReaction(items: ReactionItem[], id: string, add: boolean): ReactionItem[] {
	const choice = REACTION_CHOICES_BY_ID.get(id);
	const current = items.find((item) => item.id === id);
	if (!choice || (add && current?.self)) {
		return items;
	}
	const self = !current?.self;
	const count = (current?.count ?? 0) + (self ? 1 : -1);
	const next = items.filter((item) => item.id !== id);
	if (count > 0) {
		const replacement = createDemoReaction(choice, count, self);
		const index = items.findIndex((item) => item.id === id);
		if (index < 0) {
			next.push(replacement);
		} else {
			next.splice(index, 0, replacement);
		}
	}
	return next;
}

export function updateComment(
	items: DemoComment[],
	id: string,
	update: (item: DemoComment) => DemoComment,
): DemoComment[] {
	return items.map((item) => {
		if (item.id === id) {
			return update(item);
		}
		return { ...item, replies: updateComment(item.replies, id, update) };
	});
}

export function ReplyComposer({
	author,
	onSubmit,
}: {
	author: string;
	onSubmit: (body: string) => void;
}) {
	const [body, setBody] = useState("");
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				const text = body.trim();
				if (text) {
					onSubmit(text);
				}
			}}
		>
			<Textarea
				aria-label={`回复 ${author}`}
				value={body}
				onChange={(event) => setBody(event.target.value)}
				rows={2}
				maxLength={120}
				required
			/>
			<Button type="submit" size="sm" disabled={!body.trim()}>
				发送回复
			</Button>
		</form>
	);
}
