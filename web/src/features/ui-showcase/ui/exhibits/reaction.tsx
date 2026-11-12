import { type EmojiPickerItem, EmojiPickerPanel, ReactionBar, type ReactionItem } from "@violet/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import {
	createDemoReaction,
	createInitialReactions,
	createReactionPickerGroups,
	REACTION_CHOICES,
	REACTION_CHOICES_BY_ID,
} from "./reaction-data";

function ReactionPicker({
	items,
	onSelect,
	close,
}: {
	items: readonly ReactionItem[];
	onSelect: (id: string) => void;
	close: () => void;
}) {
	const [group, setGroup] = useState("small");
	const groups = useMemo(() => createReactionPickerGroups(items), [items]);
	return (
		<EmojiPickerPanel
			groups={groups}
			activeGroup={group}
			onGroupChange={setGroup}
			onSelect={(item) => {
				onSelect(item.id);
				close();
			}}
		/>
	);
}

/** 受控数据用于展示成功切换和失败回滚；形变、键盘与名单由真实 SDK 处理。 */
export function ReactionScene({ state }: ExhibitRenderProps) {
	const [items, setItems] = useState(() => createInitialReactions(state));
	const [recentIds, setRecentIds] = useState(() =>
		REACTION_CHOICES.slice(0, 8).map((item) => item.id),
	);
	const [notice, setNotice] = useState("");
	const [pending, setPending] = useState(false);
	const rollback = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(rollback.current), []);
	const chat = state === "chat" || state === "chat-mine" || state === "limit";
	const mine = state === "chat-mine";
	const visitor = state === "visitor";
	const disabled = pending || state === "pending";
	const recent = useMemo(() => {
		const ordered: EmojiPickerItem[] = [];
		for (const id of recentIds) {
			const choice = REACTION_CHOICES_BY_ID.get(id);
			if (choice) {
				ordered.push(choice);
			}
		}
		return ordered;
	}, [recentIds]);

	const change = (id: string, mode: "add" | "toggle") => {
		if (disabled) {
			return;
		}
		if (visitor) {
			setNotice("登录后可以回应");
			return;
		}
		const choice = REACTION_CHOICES_BY_ID.get(id);
		if (!choice) {
			return;
		}
		const current = items.find((item) => item.id === id);
		if (mode === "add" && current?.self) {
			return;
		}
		const self = !current?.self;
		let selectedCount = 0;
		for (const item of items) {
			if (item.self) {
				selectedCount += 1;
			}
		}
		if (chat && self && selectedCount >= 3) {
			setNotice("单条消息最多 3 种回应，先取消一种");
			return;
		}
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
		setItems(next);
		setNotice("");
		if (self && mode === "add") {
			setRecentIds((previous) => [id, ...previous.filter((key) => key !== id)].slice(0, 8));
		}
		if (state === "rollback") {
			setPending(true);
			rollback.current = window.setTimeout(() => {
				setItems(items);
				setPending(false);
				setNotice("回应没有成功");
			}, 320);
		}
	};

	return (
		<div className="flex h-full w-full flex-col justify-end p-6">
			<div
				className={`flex w-full max-w-85 flex-col gap-3 ${mine ? "items-end" : "items-start"}`}
			>
				<p className="text-xs text-muted-foreground">{chat ? "聊天" : "评论"}</p>
				<p className="text-sm leading-7">雨停之后，再沿着河谷往前走一段。</p>
				<ReactionBar
					className={mine ? "justify-end" : undefined}
					items={items}
					recentItems={recent}
					onToggle={(id) => change(id, "toggle")}
					onAdd={visitor ? undefined : (id) => change(id, "add")}
					maxSelected={chat ? 3 : undefined}
					collapseAfter={chat ? 6 : undefined}
					disabled={disabled}
					onLimit={() => setNotice("单条消息最多 3 种回应，先取消一种")}
					renderPicker={({ close }) => (
						<ReactionPicker
							items={items}
							onSelect={(id) => change(id, "add")}
							close={close}
						/>
					)}
				/>
				<p role="status" className="min-h-5 text-xs text-muted-foreground">
					{notice}
				</p>
			</div>
		</div>
	);
}

function Reactions({ state }: ExhibitRenderProps) {
	return <ReactionScene key={state} state={state} />;
}

export const reactionExhibit: Exhibit = {
	id: "reaction",
	name: "回应条",
	units: ["reaction"],
	zone: "stage",
	category: "action",
	footprint: { width: 720, height: 420 },
	states: [
		{ id: "comments", label: "评论换行" },
		{ id: "chat", label: "聊天折叠" },
		{ id: "chat-mine", label: "自己的消息" },
		{ id: "limit", label: "达到上限" },
		{ id: "visitor", label: "访客" },
		{ id: "empty", label: "还没有回应" },
		{ id: "single", label: "取消最后一人" },
		{ id: "counts", label: "99 与 99+" },
		{ id: "rollback", label: "失败回滚" },
		{ id: "pending", label: "正在提交" },
	],
	Render: Reactions,
};
