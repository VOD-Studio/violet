"use client";

import { Check, LockKeyhole } from "lucide-react";
import { type MouseEvent, memo } from "react";
import { emojiItemDescription, emojiItemName } from "./emoji-text";
import type { EmojiCell } from "./navigation";
import type { EmojiPickerItem, EmojiPickerSection } from "./types";

interface EmojiSectionProps {
	section: EmojiPickerSection;
	cells: readonly EmojiCell[];
	row: number;
	activeKey: string | null;
	allowSelected: boolean;
	optionId: (key: string) => string;
	optionRefs: Map<string, HTMLButtonElement>;
	onHighlight: (cell: EmojiCell, element: HTMLElement, moved: boolean) => void;
	onSelect: (item: EmojiPickerItem) => void;
}

export function EmojiSection({
	section,
	cells,
	row,
	activeKey,
	...optionProps
}: EmojiSectionProps) {
	if (cells.length === 0) {
		return null;
	}
	return (
		<div
			role="group"
			aria-label={section.label}
			className="v-emoji-picker__items"
			data-density={section.density}
			data-has-action={section.action != null}
			style={{ gridRow: row }}
		>
			{cells.map((cell) => (
				<EmojiOption
					key={cell.key}
					cell={cell}
					isActive={activeKey === cell.key}
					{...optionProps}
				/>
			))}
		</div>
	);
}

interface EmojiSectionExtrasProps {
	section: EmojiPickerSection;
	row: number;
	labelRefs: Map<string, HTMLDivElement>;
}

export function EmojiSectionExtras({ section, row, labelRefs }: EmojiSectionExtrasProps) {
	const setLabelRef = (element: HTMLDivElement | null) => {
		if (element) {
			labelRefs.set(section.id, element);
		} else {
			labelRefs.delete(section.id);
		}
	};
	return (
		<>
			<div
				ref={setLabelRef}
				className="v-emoji-picker__label"
				style={{ gridRow: row - 1 }}
				aria-hidden="true"
			>
				<span>{section.label}</span>
				<span>{section.items.length}</span>
			</div>
			{(section.action != null || section.items.length === 0) && (
				<div
					className="v-emoji-picker__items v-emoji-picker__extras"
					data-density={section.density}
					style={{ gridRow: row }}
				>
					{section.action != null && (
						<div className="v-emoji-picker__action">{section.action}</div>
					)}
					{section.items.length === 0 && (
						<p className="v-emoji-picker__section-empty">
							{section.emptyMessage ?? "这个分组还没有表情"}
						</p>
					)}
				</div>
			)}
		</>
	);
}

interface EmojiOptionProps
	extends Pick<
		EmojiSectionProps,
		"optionId" | "optionRefs" | "onHighlight" | "onSelect" | "allowSelected"
	> {
	cell: EmojiCell;
	isActive: boolean;
}

const EmojiOption = memo(function EmojiOption({
	cell,
	isActive,
	allowSelected,
	optionId,
	optionRefs,
	onHighlight,
	onSelect,
}: EmojiOptionProps) {
	const { item, key } = cell;
	const setRef = (element: HTMLButtonElement | null) => {
		if (element) {
			optionRefs.set(key, element);
		} else {
			optionRefs.delete(key);
		}
	};
	const highlightOnEnter = (event: MouseEvent<HTMLButtonElement>) => {
		onHighlight(cell, event.currentTarget, false);
	};
	const highlightOnMove = (event: MouseEvent<HTMLButtonElement>) => {
		onHighlight(cell, event.currentTarget, true);
	};
	const select = () => {
		if (!item.disabledReason && (!item.selected || allowSelected)) {
			onSelect(item);
		}
	};

	return (
		<button
			ref={setRef}
			id={optionId(key)}
			type="button"
			role="option"
			tabIndex={-1}
			aria-label={emojiItemName(item)}
			aria-description={emojiItemDescription(item)}
			aria-disabled={Boolean(item.disabledReason || (item.selected && !allowSelected))}
			aria-selected={item.selected === true}
			data-active={isActive}
			className="v-emoji-picker__item"
			onMouseDown={preventPointerFocus}
			onMouseEnter={highlightOnEnter}
			onMouseMove={highlightOnMove}
			onClick={select}
		>
			<span className="v-emoji-picker__content" aria-hidden="true">
				{item.content}
			</span>
			{item.selected && (
				<Check
					className="v-emoji-picker__check"
					size={12}
					strokeWidth={2}
					aria-hidden="true"
				/>
			)}
			{!item.selected && item.disabledReason && (
				<LockKeyhole
					className="v-emoji-picker__lock"
					size={10}
					strokeWidth={1.75}
					aria-hidden="true"
				/>
			)}
		</button>
	);
});

function preventPointerFocus(event: MouseEvent<HTMLButtonElement>) {
	event.preventDefault();
}
