"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useLayoutEffect, useRef } from "react";
import { Button } from "../button";
import { ListHighlight, ListHighlightItem } from "../list-highlight";
import type { EmojiPickerGroup } from "./types";

interface EmojiTabsProps {
	groups: readonly EmojiPickerGroup[];
	activeGroup: string;
	onGroupChange: (id: string) => void;
	id: string;
}

/** 标签以 roving focus 导航；指针切换分组不抢编辑器焦点。 */
export function EmojiTabs({ groups, activeGroup, onGroupChange, id }: EmojiTabsProps) {
	const strip = useRef<HTMLDivElement>(null);
	const tabs = useRef(new Map<string, HTMLButtonElement>());
	const current = Math.max(
		0,
		groups.findIndex((group) => group.id === activeGroup),
	);

	useLayoutEffect(() => {
		const selected = tabs.current.get(activeGroup);
		if (!selected || !strip.current) {
			return;
		}
		const left = selected.offsetLeft;
		const right = left + selected.offsetWidth;
		if (left < strip.current.scrollLeft) {
			strip.current.scrollLeft = left;
		} else if (right > strip.current.scrollLeft + strip.current.clientWidth) {
			strip.current.scrollLeft = right - strip.current.clientWidth;
		}
	}, [activeGroup]);

	const move = (index: number, focus: boolean) => {
		const group = groups[index];
		if (!group) {
			return;
		}
		onGroupChange(group.id);
		if (focus) {
			tabs.current.get(group.id)?.focus();
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const focusedIndex = groups.findIndex(
			(group) => tabs.current.get(group.id) === event.target,
		);
		const startIndex = focusedIndex >= 0 ? focusedIndex : current;
		let next: number;
		switch (event.key) {
			case "ArrowRight":
				next = (startIndex + 1) % groups.length;
				break;
			case "ArrowLeft":
				next = (startIndex - 1 + groups.length) % groups.length;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = groups.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		move(next, true);
	};

	return (
		<div className="v-emoji-picker__tabs">
			<Button
				iconOnly
				variant="ghost"
				size="sm"
				aria-label="上一组"
				disabled={current === 0}
				tabIndex={-1}
				onMouseDown={preventPointerFocus}
				onClick={() => move(current - 1, false)}
			>
				<ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
			</Button>
			<ListHighlight mode="active">
				<div
					ref={strip}
					className="v-emoji-picker__strip"
					role="tablist"
					aria-label="表情分组"
					onKeyDown={handleKeyDown}
				>
					{groups.map((group, index) => (
						<ListHighlightItem key={group.id} active={index === current}>
							<button
								ref={(element) => {
									if (element) {
										tabs.current.set(group.id, element);
									} else {
										tabs.current.delete(group.id);
									}
								}}
								type="button"
								role="tab"
								id={`${id}-tab-${index}`}
								aria-controls={`${id}-grid`}
								aria-selected={index === current}
								aria-label={group.label}
								title={group.label}
								tabIndex={index === current ? 0 : -1}
								className="v-emoji-picker__tab"
								onMouseDown={preventPointerFocus}
								onClick={() => move(index, false)}
							>
								{group.icon ? (
									<span className="v-emoji-picker__tab-icon" aria-hidden="true">
										{group.icon}
									</span>
								) : (
									group.label
								)}
							</button>
						</ListHighlightItem>
					))}
				</div>
			</ListHighlight>
			<Button
				iconOnly
				variant="ghost"
				size="sm"
				aria-label="下一组"
				disabled={current >= groups.length - 1}
				tabIndex={-1}
				onMouseDown={preventPointerFocus}
				onClick={() => move(current + 1, false)}
			>
				<ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
			</Button>
		</div>
	);
}

function preventPointerFocus(event: MouseEvent<HTMLButtonElement>) {
	event.preventDefault();
}
