import type { SeriesSummary } from "@features/series/model/types";
import { BookCover } from "@features/series/ui/BookCover";
import { formatDate } from "@shared/lib/date";
import { markSharedSource, SERIES_SCOPE, SharedElement } from "@shared/lib/view-transition";
import { Link } from "@tanstack/react-router";
import { Empty } from "@violet/ui";

function ShelfCard({ book }: { book: SeriesSummary }) {
	return (
		<Link
			to="/blog/series/$slug"
			params={{ slug: book.slug }}
			onClick={() => markSharedSource("cover", book.slug, SERIES_SCOPE)}
			className="mx-auto block w-full max-w-56 focus-visible:outline-2"
		>
			<SharedElement name="cover" id={book.slug}>
				<BookCover book={book} className="w-full" />
			</SharedElement>
			<h3 className="mt-4 line-clamp-1 font-semibold">{book.title}</h3>
			<p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
				{book.chapter_count > 0 ? `${book.chapter_count} 章` : "尚未挂章"}
				{book.latest_chapter_at
					? ` · ${formatDate(book.latest_chapter_at, "slash-date", "")}`
					: ""}
			</p>
		</Link>
	);
}

/** 当前页的公开系列；章节总数保留全书口径。 */
export interface SeriesShelfProps {
	books: SeriesSummary[];
}

/** 系列当前页的书架；分页和筛选由博客路由持有，不在内部追加页面。 */
export function SeriesShelf({ books }: SeriesShelfProps) {
	if (!books.length) return <Empty title="暂无系列" />;
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
			{books.map((book) => (
				<ShelfCard key={book.id} book={book} />
			))}
		</div>
	);
}
