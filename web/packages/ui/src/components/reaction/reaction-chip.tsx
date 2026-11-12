import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { displayCount, isTextEmoji, reactionLabel, reactionPeople } from "./presentation";
import type { ReactionItem } from "./types";
import {
	useReactionCountMotion,
	useReactionEntryMotion,
	useReactionSelfMotion,
} from "./use-reaction-motion";
import type { ReactionEntry } from "./use-reaction-presence";

interface ReactionChipProps {
	entry: ReactionEntry;
	container: HTMLDivElement | null;
	disabled: boolean;
	limited: boolean;
	onToggle?: (id: string) => void;
	onLimit?: () => void;
	onSettle: (id: string, exiting: boolean) => void;
	onFocusExit: (id: string) => void;
}

export function ReactionChip({
	entry,
	container,
	disabled,
	limited,
	onToggle,
	onLimit,
	onSettle,
	onFocusExit,
}: ReactionChipProps) {
	const { item, exiting } = entry;
	const entryRef = useReactionEntryMotion({ entry, onSettle, onFocusExit });
	const chipRef = useReactionSelfMotion(item.self);
	const className = cn("v-reaction__chip", {
		"v-reaction__chip--self": item.self,
		"v-reaction__chip--readonly": !onToggle,
	});
	const label = reactionLabel(item);
	const content = <ChipContent item={item} />;

	const activate = () => {
		if (!onToggle || disabled || exiting) {
			return;
		}
		if (limited && !item.self) {
			onLimit?.();
			return;
		}
		onToggle?.(item.id);
	};

	return (
		<span
			ref={entryRef}
			className="v-reaction__entry"
			data-reaction-id={item.id}
			data-exiting={exiting || undefined}
			aria-hidden={exiting || undefined}
			inert={exiting || undefined}
		>
			<Tooltip open={exiting ? false : undefined}>
				<TooltipTrigger asChild>
					<button
						ref={chipRef}
						type="button"
						className={className}
						aria-label={label}
						aria-pressed={item.self}
						aria-disabled={
							!onToggle || disabled || (limited && !item.self) || undefined
						}
						onClick={activate}
					>
						{content}
					</button>
				</TooltipTrigger>
				<TooltipContent container={container} className="v-reaction__tooltip">
					{item.name} · {reactionPeople(item)}
				</TooltipContent>
			</Tooltip>
		</span>
	);
}

function ChipContent({ item }: { item: ReactionItem }) {
	const countRef = useReactionCountMotion(item.count);
	return (
		<>
			<span
				aria-hidden="true"
				className={cn("v-reaction__emoji", {
					"v-reaction__emoji--text": isTextEmoji(item.content),
				})}
			>
				{item.content}
			</span>
			<span className="v-reaction__count" aria-hidden="true">
				<span ref={countRef} className="v-reaction__number">
					{displayCount(item.count)}
				</span>
			</span>
		</>
	);
}
