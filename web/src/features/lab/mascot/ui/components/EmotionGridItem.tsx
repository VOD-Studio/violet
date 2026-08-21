import { cn } from "@shared/lib/utils";
import type { EmotionDef } from "@violet/mascot";
import { Mascot } from "@violet/mascot";
import { useEffect, useRef } from "react";

interface EmotionGridItemProps {
	def: EmotionDef;
	active: boolean;
	onSelect: (id: string) => void;
}

/** 陈列卡:frozen 静态快照,hover 本地起动预览,click 固定并交由舞台上演。 */
export function EmotionGridItem({ def, active, onSelect }: EmotionGridItemProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const mascotRef = useRef<Mascot | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		const m = new Mascot(hostRef.current, { emotion: def.id, frozen: true });
		mascotRef.current = m;
		return () => {
			m.destroy();
			mascotRef.current = null;
		};
	}, [def.id]);

	return (
		<div
			onClick={() => onSelect(def.id)}
			onKeyDown={(e) => e.key === "Enter" && onSelect(def.id)}
			onPointerEnter={() => mascotRef.current?.start()}
			onPointerLeave={() => mascotRef.current?.stop()}
			tabIndex={0}
			role="button"
			className={cn(
				"flex h-34 cursor-pointer flex-col items-center justify-between rounded-xl border p-3 text-center transition-colors duration-150",
				active
					? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40 text-foreground"
					: "border-border bg-card hover:border-foreground/30",
			)}
		>
			<span className="self-start font-mono text-[11px] text-muted-foreground">
				#{def.id}
			</span>

			<div ref={hostRef} className="my-1 size-16" />

			<div className="w-full">
				<p className="truncate text-xs font-medium text-foreground">{def.name}</p>
				<p className="truncate font-mono text-[10px] text-muted-foreground">{def.en}</p>
			</div>
		</div>
	);
}
