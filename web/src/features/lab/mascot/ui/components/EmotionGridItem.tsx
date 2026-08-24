import { cn } from "@shared/lib/utils";
import type { EmotionDef } from "@violet/mascot";
import { Mascot } from "@violet/mascot";
import { useEffect, useRef } from "react";

type EmotionGridItemVariant = "grid" | "rail";

interface EmotionGridItemProps {
	def: EmotionDef;
	active: boolean;
	onSelect: (id: string) => void;
	variant?: EmotionGridItemVariant;
}

/** 表情缩略图，聚焦或悬停时播放，选择后固定到主舞台。 */
export function EmotionGridItem({ def, active, onSelect, variant = "grid" }: EmotionGridItemProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const mascotRef = useRef<Mascot | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		const mascot = new Mascot(hostRef.current, { emotion: def.id, frozen: true });
		mascotRef.current = mascot;
		return () => {
			mascot.destroy();
			mascotRef.current = null;
		};
	}, [def.id]);

	useEffect(() => {
		if (!active) return;
		const button = buttonRef.current;
		const scroller = button?.closest<HTMLElement>("[data-emotion-scroll]");
		if (!button || !scroller) return;

		const itemRect = button.getBoundingClientRect();
		const scrollerRect = scroller.getBoundingClientRect();
		if (variant === "rail") {
			scroller.scrollLeft +=
				itemRect.left - scrollerRect.left - (scroller.clientWidth - itemRect.width) / 2;
			return;
		}
		if (itemRect.top < scrollerRect.top) {
			scroller.scrollTop -= scrollerRect.top - itemRect.top;
		} else if (itemRect.bottom > scrollerRect.bottom) {
			scroller.scrollTop += itemRect.bottom - scrollerRect.bottom;
		}
	}, [active, variant]);

	return (
		<button
			ref={buttonRef}
			type="button"
			data-emotion-id={def.id}
			onClick={() => onSelect(def.id)}
			onPointerEnter={() => mascotRef.current?.start()}
			onPointerLeave={() => mascotRef.current?.stop()}
			onFocus={() => mascotRef.current?.start()}
			onBlur={() => mascotRef.current?.stop()}
			aria-pressed={active}
			className={cn(
				"group relative flex cursor-pointer flex-col items-center justify-end overflow-hidden bg-background text-center text-foreground transition-colors duration-200 hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-blue",
				variant === "grid"
					? "min-h-31 border-r border-b border-edge-hairline p-3"
					: "w-24 shrink-0 border border-edge-hairline px-2 py-2.5",
				active &&
					"bg-muted/60 text-neon-blue shadow-[inset_3px_0_0_var(--color-neon-blue)] hover:bg-muted/60",
			)}
		>
			<span
				className={cn(
					"absolute top-2 left-2 font-mono text-[8px] font-semibold tabular-nums text-muted-foreground",
					active && "text-neon-blue",
				)}
			>
				{def.id}
			</span>
			{active ? (
				<span aria-hidden className="absolute top-2 right-2 size-1.5 bg-neon-blue" />
			) : null}
			<div
				ref={hostRef}
				className={cn(
					"transition-transform duration-200 group-hover:scale-105",
					variant === "grid" ? "mb-1.5 size-16" : "mb-1 size-13",
				)}
			/>
			<p
				className={cn(
					"w-full truncate font-semibold leading-tight",
					variant === "grid" ? "text-xs" : "text-[11px]",
				)}
			>
				{def.name}
			</p>
			<p
				className={cn(
					"mt-0.5 w-full truncate font-mono leading-tight text-muted-foreground",
					variant === "grid" ? "text-[9px]" : "text-[8px]",
				)}
			>
				{def.en}
			</p>
		</button>
	);
}
