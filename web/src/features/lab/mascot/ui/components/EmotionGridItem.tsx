import { cn } from "@shared/lib/utils";
import type { EmotionDef } from "@violet/mascot";
import { Mascot } from "@violet/mascot";
import { useEffect, useRef } from "react";

interface EmotionGridItemProps {
	def: EmotionDef;
	active: boolean;
	onSelect: (id: string) => void;
}

/** 表情缩略图，聚焦或悬停时播放，选择后固定到主舞台。 */
export function EmotionGridItem({ def, active, onSelect }: EmotionGridItemProps) {
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
		if (active) buttonRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [active]);
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
				"group relative flex min-h-28 cursor-pointer flex-col items-center justify-end bg-[#f8f9f5] p-2.5 text-center text-[#11110f] transition-colors duration-200 hover:bg-[#eceee9] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent)",
				active && "bg-[#ebe7e0] hover:bg-[#ebe7e0]",
			)}
		>
			{active ? (
				<span
					aria-hidden
					className="absolute top-2 right-2 size-1.5 bg-(--mascot-accent)"
				/>
			) : null}
			<span className="absolute top-2 left-2 font-mono text-[9px] font-semibold tabular-nums opacity-55">
				{def.id}
			</span>
			<div
				ref={hostRef}
				className="mb-1 size-14 transition-transform duration-200 group-hover:scale-105"
			/>
			<p className="w-full truncate text-xs font-semibold leading-tight">{def.name}</p>
			<p className="mt-0.5 w-full truncate font-mono text-[9px] leading-tight opacity-55">
				{def.en}
			</p>
		</button>
	);
}
