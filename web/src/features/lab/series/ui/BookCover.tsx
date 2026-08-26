import { cn } from "@shared/lib/utils";
import type { MockBook } from "../model/mock";

const COVER_PLANE =
	"absolute inset-y-0 right-1 bottom-1 left-0 overflow-hidden rounded-sm shadow-lg [backface-visibility:hidden]";

const COVER_PLANE_STYLE = {
	transform: "rotateY(-5deg)",
	transformOrigin: "left center",
	transformStyle: "preserve-3d",
} as const;

function CoverEdges() {
	return (
		<>
			<div
				aria-hidden="true"
				className="absolute inset-y-1 right-0 w-2 rounded-r-sm bg-stone-200 shadow-sm"
			>
				<span className="absolute inset-y-1 left-1/2 w-px bg-stone-500/40" />
				<span className="absolute inset-y-2 left-1/4 w-px bg-stone-500/25" />
			</div>
			<div
				aria-hidden="true"
				className="absolute right-1 bottom-0 left-1 h-1.5 rounded-b-sm bg-stone-200 shadow-sm"
			>
				<span className="absolute inset-x-1 top-1/2 h-px bg-stone-500/40" />
			</div>
		</>
	);
}

export function BookCover({ book, className }: { book: MockBook; className?: string }) {
	const label = `${book.title}封面`;

	if (!book.coverUrl) {
		return (
			<div
				role="img"
				aria-label={label}
				className={cn("relative isolate aspect-2/3 [perspective:900px]", className)}
			>
				<CoverEdges />
				<div
					className={cn(COVER_PLANE, "bg-foreground text-background")}
					style={COVER_PLANE_STYLE}
				>
					<div className="pointer-events-none absolute inset-2 border border-background/20" />
					<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-linear-to-r from-black/20 to-transparent" />
					<div className="relative flex h-full flex-col justify-between p-4">
						<div className="flex items-center justify-between border-b border-background/25 pb-2 font-mono text-[9px] tracking-[0.2em] text-background/65 uppercase">
							<span>Violet</span>
							<span>Editions</span>
						</div>
						<div className="my-6">
							<p className="font-mono text-[9px] tracking-[0.2em] text-background/50 uppercase">
								Online Book
							</p>
							<h2 className="mt-3 line-clamp-3 font-serif text-2xl leading-tight">
								{book.title}
							</h2>
							<p className="mt-2 line-clamp-3 font-serif text-sm leading-snug text-background/65 italic">
								{book.subtitle}
							</p>
						</div>
						<div className="flex items-end justify-between border-t border-background/25 pt-3 font-mono text-[9px] text-background/55 uppercase">
							<span>{book.author}</span>
							<span>{book.status === "ongoing" ? "Serial" : "Complete"}</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			role="img"
			aria-label={label}
			className={cn("relative isolate aspect-2/3 [perspective:900px]", className)}
		>
			<CoverEdges />
			<div className={cn(COVER_PLANE, "bg-muted")} style={COVER_PLANE_STYLE}>
				<img
					src={book.coverUrl}
					alt=""
					loading="lazy"
					className="size-full object-cover"
				/>
				<div className="pointer-events-none absolute inset-2 border border-white/35" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
				<div className="absolute inset-x-3 bottom-3 text-white">
					<p className="font-mono text-[8px] tracking-[0.2em] text-white/75 uppercase">
						Violet Editions
					</p>
					<p className="mt-1 line-clamp-2 font-serif text-sm leading-tight">{book.title}</p>
				</div>
			</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-linear-to-r from-black/30 to-transparent"
			/>
		</div>
	);
}
