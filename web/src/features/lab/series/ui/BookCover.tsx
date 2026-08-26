import type { ReactNode } from "react";

import { cn } from "@shared/lib/utils";
import type { MockBook } from "../model/mock";

const COVER_PLANE =
	"absolute inset-y-0 right-2 bottom-2 left-0 overflow-hidden rounded-sm shadow-xl [backface-visibility:hidden]";

const COVER_PLANE_STYLE = {
	transform: "rotateY(-7deg)",
	transformOrigin: "left center",
	transformStyle: "preserve-3d",
} as const;

function CoverEdges() {
	return (
		<>
			<div
				aria-hidden="true"
				className="absolute inset-y-1 right-0 z-0 w-3 rounded-r-sm border border-stone-400/50 bg-stone-200 shadow-sm"
			>
				<span className="absolute inset-y-2 left-1/3 w-px bg-stone-500/40" />
				<span className="absolute inset-y-2 left-2/3 w-px bg-stone-500/25" />
			</div>
			<div
				aria-hidden="true"
				className="absolute right-1 bottom-0 left-1 z-0 h-2 rounded-b-sm border border-stone-400/50 bg-stone-200 shadow-sm"
			>
				<span className="absolute inset-x-2 top-1/3 h-px bg-stone-500/35" />
				<span className="absolute inset-x-2 top-2/3 h-px bg-stone-500/20" />
			</div>
		</>
	);
}

function CoverShell({
	book,
	className,
	children,
}: {
	book: MockBook;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			role="img"
			aria-label={`${book.title}封面`}
			className={cn("relative isolate aspect-2/3 [perspective:900px]", className)}
		>
			<CoverEdges />
			<div className={COVER_PLANE} style={COVER_PLANE_STYLE}>
				{children}
			</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-2 bg-linear-to-r from-black/35 to-transparent"
			/>
		</div>
	);
}

function statusLabel(book: MockBook) {
	return book.status === "ongoing" ? "Serial" : "Complete";
}

export function BookCover({ book, className }: { book: MockBook; className?: string }) {
	if (!book.coverUrl) {
		const coverMark = book.title.slice(0, 2);

		return (
			<CoverShell book={book} className={className}>
				<div className="relative h-full w-full overflow-hidden bg-stone-100 text-stone-900">
					<div className="pointer-events-none absolute inset-3 border border-stone-900/20" />
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -top-2 right-0 font-serif text-7xl leading-none text-stone-900/10"
					>
						{coverMark}
					</div>
					<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-linear-to-r from-stone-900/25 to-transparent" />
					<div className="relative flex h-full flex-col p-4">
						<div className="flex items-center justify-between border-b border-stone-900/20 pb-2 font-mono text-[9px] tracking-[0.2em] text-stone-900/60 uppercase">
							<span>Violet Editions</span>
							<span>{statusLabel(book)}</span>
						</div>
						<div className="flex flex-1 flex-col justify-center">
							<p className="font-mono text-[9px] tracking-[0.2em] text-stone-900/45 uppercase">
								Online Book
							</p>
							<h2 className="mt-3 line-clamp-3 font-serif text-2xl leading-tight">
								{book.title}
							</h2>
							<p className="mt-2 line-clamp-3 font-serif text-sm leading-snug text-stone-900/60 italic">
								{book.subtitle}
							</p>
						</div>
						<div className="flex items-end justify-between border-t border-stone-900/20 pt-3 font-mono text-[9px] text-stone-900/50 uppercase">
							<span>{book.author}</span>
							<span>Technical Series</span>
						</div>
					</div>
				</div>
			</CoverShell>
		);
	}

	return (
		<CoverShell book={book} className={className}>
			<div className="relative h-full w-full bg-muted">
				<img
					src={book.coverUrl}
					alt=""
					loading="lazy"
					className="size-full object-cover"
				/>
				<div className="pointer-events-none absolute inset-3 border border-white/40" />
				<div className="absolute inset-x-4 top-4 flex items-center justify-between font-mono text-[8px] tracking-[0.2em] text-white/80 uppercase drop-shadow-sm">
					<span>Violet Editions</span>
					<span>{statusLabel(book)}</span>
				</div>
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
				<div className="absolute inset-x-4 bottom-4 text-white drop-shadow-sm">
					<p className="line-clamp-2 font-serif text-base leading-tight">{book.title}</p>
					<p className="mt-1 line-clamp-2 font-serif text-[10px] leading-snug text-white/75 italic">
						{book.subtitle}
					</p>
				</div>
			</div>
		</CoverShell>
	);
}
