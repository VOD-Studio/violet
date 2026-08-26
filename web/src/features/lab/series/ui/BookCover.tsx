import { cn } from "@shared/lib/utils";
import type { MockBook } from "../model/mock";

export function BookCover({ book, className }: { book: MockBook; className?: string }) {
	if (!book.coverUrl) {
		return (
			<div
				role="img"
				aria-label={`${book.title}封面`}
				className={cn(
					"relative flex aspect-2/3 overflow-hidden rounded-sm bg-foreground text-background shadow-sm",
					className,
				)}
			>
				<div className="pointer-events-none absolute inset-3 border border-background/15" />
				<div className="relative flex h-full w-full flex-col justify-between p-4">
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
		);
	}
	return (
		<img
			src={book.coverUrl}
			alt={book.title}
			loading="lazy"
			className={cn("aspect-2/3 rounded-sm object-cover", className)}
		/>
	);
}
