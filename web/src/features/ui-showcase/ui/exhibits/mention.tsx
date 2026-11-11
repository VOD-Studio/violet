import { MENTION_ALL } from "@shared/lib/mention-token";
import {
	filterMentionCandidates,
	type MentionCandidate,
	MentionList,
	mentionOptionId,
	parseMentionTrigger,
} from "@violet/ui";
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const COMMENT_CANDIDATES: MentionCandidate[] = [
	{ id: "u1", username: "xunrua", displayName: "xunrua" },
	{ id: "u2", username: "linjian", displayName: "林间" },
	{ id: "u3", username: "saber", displayName: "Saber", isBot: true },
	{ id: "u4", username: "sam_s", displayName: "Sam" },
	{ id: "u5", username: "wuli", displayName: "雾里" },
	{ id: "u6", username: "momo", displayName: "Momo" },
	{ id: "u7", username: "xiaojing", displayName: "小径" },
];

const ROOM_CANDIDATES: MentionCandidate[] = [
	{ ...MENTION_ALL, memberCount: 23 },
	{ id: "u1", username: "xunrua", displayName: "xunrua", role: "owner" },
	{ id: "u2", username: "linjian", displayName: "林间", role: "member" },
	{ id: "u3", username: "saber", displayName: "Saber", isBot: true },
	{ id: "u4", username: "sam_s", displayName: "Sam" },
	{ id: "u5", username: "wuli", displayName: "雾里" },
	{ id: "u6", username: "momo", displayName: "Momo" },
];

/** 真实的触发、筛选、键盘与插入，输入框只是宿主（站内是 contentEditable）。 */
function MentionField({ state }: ExhibitRenderProps) {
	const listboxID = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const pendingCaret = useRef<number | null>(null);
	const room = state === "room";
	const candidates = room ? ROOM_CANDIDATES : COMMENT_CANDIDATES;
	const [value, setValue] = useState("@");
	const [caret, setCaret] = useState(1);
	const [activeIndex, setActiveIndex] = useState(0);
	const [dismissed, setDismissed] = useState(false);
	const trigger = dismissed ? null : parseMentionTrigger(value, caret);
	const matches = trigger ? filterMentionCandidates(candidates, trigger.query) : [];
	const open = trigger !== null;
	const active = matches[activeIndex];
	useLayoutEffect(() => {
		if (pendingCaret.current === null) return;
		inputRef.current?.focus();
		inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
		pendingCaret.current = null;
	}, [value]);
	const insert = (candidate: MentionCandidate) => {
		if (!trigger) return;
		const inserted = `@${candidate.displayName}\u00a0`;
		const nextCaret = trigger.start + inserted.length;
		pendingCaret.current = nextCaret;
		setValue(`${value.slice(0, trigger.start)}${inserted}${value.slice(trigger.end)}`);
		setCaret(nextCaret);
		setDismissed(true);
		setActiveIndex(0);
	};
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing || !open) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (matches.length === 0) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActiveIndex((index) => (index + step + matches.length) % matches.length);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setDismissed(true);
			return;
		}
		if ((event.key === "Enter" || event.key === "Tab") && active && trigger) {
			event.preventDefault();
			insert(active);
		}
	};

	return (
		<div className="flex h-full flex-col gap-3">
			<div className="relative">
				<span className="mb-2 block text-12 text-muted-foreground">
					{room ? "在聊天房间里提及" : "在评论里提及"}
				</span>
				{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: 与站内一致，可编辑输入默认 role=textbox 且带 aria-expanded */}
				<input
					ref={inputRef}
					aria-autocomplete="list"
					aria-activedescendant={
						open && active ? mentionOptionId(listboxID, active.id) : undefined
					}
					aria-controls={open ? listboxID : undefined}
					aria-expanded={open}
					aria-label={room ? "聊天房间消息" : "评论内容"}
					className="w-full rounded-xl border border-edge-hairline bg-muted/40 px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring"
					onChange={(event) => {
						setValue(event.target.value);
						setCaret(event.target.selectionStart ?? event.target.value.length);
						setDismissed(false);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					onSelect={(event) => {
						setCaret(event.currentTarget.selectionStart ?? value.length);
					}}
					value={value}
				/>
				{open && (
					<MentionList
						activeIndex={activeIndex}
						candidates={matches}
						className="absolute inset-s-0 top-[calc(100%+6px)]"
						id={listboxID}
						onActiveIndexChange={setActiveIndex}
						onSelect={insert}
						query={trigger.query}
					/>
				)}
			</div>
		</div>
	);
}

export const mentionExhibit: Exhibit = {
	id: "mention",
	name: "提及",
	units: ["mention"],
	zone: "field",
	category: "form",
	footprint: { width: 360, height: 330 },
	states: [
		{ id: "comment", label: "评论" },
		{ id: "room", label: "聊天房间" },
	],
	Render: MentionField,
};
