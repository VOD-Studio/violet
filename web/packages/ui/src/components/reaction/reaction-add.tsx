import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { EmojiPickerItem } from "../emoji-picker";
import {
	MorphingPopover,
	MorphingPopoverContent,
	MorphingPopoverTrigger,
} from "../morphing-popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { QuickPreview, ReactionQuick } from "./reaction-quick";
import type { ReactionBarProps } from "./types";

interface ReactionAddProps {
	recentItems: readonly EmojiPickerItem[];
	selected: ReadonlySet<string>;
	allowSelected: boolean;
	disabled: boolean;
	limited: boolean;
	maxSelected?: number;
	limitMessage?: string;
	container: HTMLDivElement | null;
	onAdd: (id: string) => void;
	onLimit?: () => void;
	renderPicker: ReactionBarProps["renderPicker"];
}

export function ReactionAdd({
	recentItems,
	selected,
	allowSelected,
	disabled,
	limited,
	maxSelected,
	limitMessage,
	container,
	onAdd,
	onLimit,
	renderPicker,
}: ReactionAddProps) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"quick" | "picker">("quick");
	const panelRef = useRef<HTMLDivElement>(null);
	const reasonId = useId();
	const reason = limitMessage ?? `最多选择 ${maxSelected} 种回应，请先取消一种`;
	const blocked = limited && !allowSelected;
	const close = useCallback(() => {
		setOpen(false);
	}, []);

	const changeOpen = (next: boolean) => {
		if (!next) {
			close();
			return;
		}
		if (disabled) {
			return;
		}
		if (blocked) {
			onLimit?.();
			return;
		}
		if (!panelRef.current) {
			setMode("quick");
		}
		setOpen(true);
	};

	useEffect(() => {
		if (disabled || blocked) {
			close();
		}
	}, [disabled, blocked, close]);

	const choose = (id: string) => {
		const alreadySelected =
			selected.has(id) || recentItems.some((item) => item.id === id && item.selected);
		if (disabled || (alreadySelected && !allowSelected)) {
			return;
		}
		if (limited && !alreadySelected) {
			onLimit?.();
			return;
		}
		close();
		onAdd(id);
	};

	let panel = (
		<ReactionQuick
			items={recentItems}
			selected={selected}
			allowSelected={allowSelected}
			limited={limited}
			disabled={disabled || !open}
			container={container}
			onChoose={choose}
			onMore={renderPicker ? () => setMode("picker") : undefined}
		/>
	);
	let ghost = (
		<span className="v-reaction__add-ghost">
			<AddGlyph />
		</span>
	);
	if (mode === "picker" && renderPicker) {
		panel = (
			<div className="v-reaction__picker" inert={!open || disabled}>
				{renderPicker({ close })}
			</div>
		);
		ghost = <QuickPreview items={recentItems} />;
	}

	return (
		<MorphingPopover className="v-reaction__add-root" open={open} onOpenChange={changeOpen}>
			<Tooltip open={open || !blocked ? false : undefined}>
				<TooltipTrigger asChild>
					<MorphingPopoverTrigger
						className="v-reaction__add"
						aria-label="添加回应"
						aria-haspopup="dialog"
						aria-disabled={disabled || blocked || undefined}
						aria-describedby={blocked ? reasonId : undefined}
					>
						<AddGlyph />
					</MorphingPopoverTrigger>
				</TooltipTrigger>
				<TooltipContent container={container} className="v-reaction__tooltip">
					{blocked ? reason : "添加回应"}
				</TooltipContent>
			</Tooltip>
			{blocked && (
				<span id={reasonId} className="v-reaction__sr-only">
					{reason}
				</span>
			)}
			<MorphingPopoverContent
				portal
				ref={panelRef}
				key={mode}
				className={`v-reaction__panel v-reaction__panel--${mode}`}
				aria-label={mode === "quick" ? "常用回应" : "选择回应"}
				radius={mode === "quick" ? 20 : 16}
				outset={6}
				ghost={ghost}
				ghostClassName="v-reaction__ghost"
			>
				{panel}
			</MorphingPopoverContent>
		</MorphingPopover>
	);
}

function AddGlyph() {
	return (
		<span className="v-reaction__add-icon" aria-hidden="true">
			<svg
				aria-hidden="true"
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M8 14s1.5 2 4 2 4-2 4-2M8.5 8.5h.01M15.5 8.5h.01" />
			</svg>
			<svg
				aria-hidden="true"
				className="v-reaction__plus"
				width="8"
				height="8"
				viewBox="0 0 8 8"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			>
				<path d="M4 1v6M1 4h6" />
			</svg>
		</span>
	);
}
