import { Segmented } from "@shared/ui/segmented";
import { ArrowLeft, ArrowRight, BookOpen, Library, ListTree } from "lucide-react";
import { useCallback, useEffect } from "react";
import type { SeriesSurface, SeriesVariant } from "../model/mock";

const SURFACES: { value: SeriesSurface; label: string; icon: typeof Library }[] = [
	{ value: "shelf", label: "书架", icon: Library },
	{ value: "detail", label: "书籍页", icon: ListTree },
	{ value: "reader", label: "阅读器", icon: BookOpen },
];

const VARIANTS: { value: SeriesVariant; label: string }[] = [
	{ value: "A", label: "阅读应用" },
	{ value: "B", label: "技术书" },
	{ value: "C", label: "编辑出版" },
];

export function SurfaceNav({
	current,
	onChange,
}: {
	current: SeriesSurface;
	onChange: (surface: SeriesSurface) => void;
}) {
	return (
		<nav className="sticky top-3 z-40 mx-auto mb-8 flex w-fit">
			<Segmented
				value={current}
				onValueChange={onChange}
				segments={SURFACES.map(({ value, label, icon: Icon }) => ({
					value,
					label: (
						<>
							<Icon className="size-4" />
							{label}
						</>
					),
				}))}
				size="default"
				rounded="full"
			/>
		</nav>
	);
}

export function VariantSwitcher({
	current,
	onChange,
}: {
	current: SeriesVariant;
	onChange: (variant: SeriesVariant) => void;
}) {
	const index = VARIANTS.findIndex((item) => item.value === current);
	const move = useCallback(
		(delta: number) => {
			const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
			onChange(next.value);
		},
		[index, onChange],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.matches("input, textarea, [contenteditable=true]")) return;
			if (event.key === "ArrowLeft" || event.key === "Left") {
				event.preventDefault();
				move(-1);
			}
			if (event.key === "ArrowRight" || event.key === "Right") {
				event.preventDefault();
				move(1);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [move]);

	const active = VARIANTS[index];
	return (
		<div className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-1 rounded-full bg-zinc-950 p-1.5 text-white shadow-2xl ring-1 ring-white/15">
			<button
				type="button"
				onClick={() => move(-1)}
				aria-label="上一个设计方向"
				className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
			>
				<ArrowLeft className="size-4" />
			</button>
			<span className="min-w-36 px-3 text-center font-mono text-xs">
				{active.value} — {active.label}
			</span>
			<button
				type="button"
				onClick={() => move(1)}
				aria-label="下一个设计方向"
				className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
			>
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}
