import { cn } from "cn";
import { type KeyboardEvent, useState } from "react";
import type { EmojiPickerItem } from "../emoji-picker";
import { ListHighlight, ListHighlightItem } from "../list-highlight";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";

interface ReactionQuickProps {
	items: readonly EmojiPickerItem[];
	selected: ReadonlySet<string>;
	limited: boolean;
	disabled: boolean;
	container: HTMLDivElement | null;
	onChoose: (id: string) => void;
	onMore?: () => void;
}

export function ReactionQuick({
	items,
	selected,
	limited,
	disabled,
	container,
	onChoose,
	onMore,
}: ReactionQuickProps) {
	const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
	const activeExists =
		items.some((item) => item.id === active) || (active === null && onMore !== undefined);
	const current = activeExists ? active : (items[0]?.id ?? null);

	const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
		const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
		if (!keys.includes(event.key)) {
			return;
		}
		const buttons = Array.from(
			event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
		);
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (buttons.length === 0) {
			return;
		}
		event.preventDefault();
		let next = index + (event.key === "ArrowRight" ? 1 : -1);
		if (event.key === "Home") {
			next = 0;
		}
		if (event.key === "End") {
			next = buttons.length - 1;
		}
		buttons[(next + buttons.length) % buttons.length]?.focus();
	};

	return (
		<ListHighlight>
			<div
				className="v-reaction__quick"
				role="toolbar"
				aria-label="常用回应"
				onKeyDown={navigate}
			>
				{items.map((item) => {
					const isSelected = selected.has(item.id) || Boolean(item.selected);
					const unavailable =
						disabled || limited || isSelected || Boolean(item.disabledReason);
					const label = isSelected ? `${item.name}，已回应` : item.name;
					return (
						<Tooltip key={item.id}>
							<TooltipTrigger asChild>
								<ListHighlightItem>
									<button
										type="button"
										className={cn("v-reaction__quick-item", {
											"v-reaction__quick-item--selected": isSelected,
										})}
										aria-label={label}
										aria-pressed={isSelected}
										aria-disabled={unavailable || undefined}
										tabIndex={item.id === current ? 0 : -1}
										onFocus={() => setActive(item.id)}
										onClick={() => {
											if (!unavailable) {
												onChoose(item.id);
											}
										}}
									>
										<span
											className="v-reaction__quick-content"
											aria-hidden="true"
										>
											{item.content}
										</span>
										{isSelected && <SelectionMark />}
									</button>
								</ListHighlightItem>
							</TooltipTrigger>
							<TooltipContent container={container}>
								{item.disabledReason ?? label}
							</TooltipContent>
						</Tooltip>
					);
				})}
				{onMore && (
					<ListHighlightItem>
						<button
							type="button"
							className="v-reaction__quick-item"
							aria-label="更多表情"
							tabIndex={current === null ? 0 : -1}
							aria-disabled={disabled || undefined}
							onFocus={() => setActive(null)}
							onClick={() => {
								if (!disabled) {
									onMore();
								}
							}}
						>
							<span aria-hidden="true">⋯</span>
						</button>
					</ListHighlightItem>
				)}
			</div>
		</ListHighlight>
	);
}

export function QuickPreview({ items }: { items: readonly EmojiPickerItem[] }) {
	return (
		<span className="v-reaction__quick-preview">
			{items.map((item) => (
				<span key={item.id} className="v-reaction__quick-item">
					<span className="v-reaction__quick-content">{item.content}</span>
				</span>
			))}
			<span className="v-reaction__quick-item">⋯</span>
		</span>
	);
}

function SelectionMark() {
	return (
		<svg
			className="v-reaction__check"
			width="8"
			height="8"
			viewBox="0 0 12 12"
			aria-hidden="true"
		>
			<path
				d="m2 6 2.5 2.5L10 3"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
