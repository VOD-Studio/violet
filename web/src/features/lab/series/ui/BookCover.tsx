import { cn } from "@shared/lib/utils";
import { ImageOff } from "lucide-react";
import type { MockBook } from "../model/mock";

export function BookCover({ book, className }: { book: MockBook; className?: string }) {
	if (!book.coverUrl) {
		return (
			<div
				className={cn(
					"flex aspect-2/3 items-center justify-center overflow-hidden rounded-sm bg-muted",
					className,
				)}
			>
				<ImageOff className="size-7 text-muted-foreground/50" />
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
