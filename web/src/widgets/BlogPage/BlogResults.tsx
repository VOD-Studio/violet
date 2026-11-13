import { ArchiveBrowse } from "@features/archive/ui/ArchiveBrowse";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import { BlogPostGrid } from "@features/posts/ui/BlogPostGrid";
import { fetchSeries, seriesKeys } from "@features/series/api";
import { SeriesShelf } from "@features/series/ui/SeriesShelf";
import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Pagination, Skeleton } from "@violet/ui";
import { BLOG_SERIES_PAGE_SIZE, type BlogSearch, type BlogView } from "./lib/search";

/** 当前视图的结果槽；筛选状态由持续挂载的外层路由持有。 */
export interface BlogResultsProps {
	view: BlogView;
	search: BlogSearch;
	/** 站点配置中的每页文章数，系列使用独立的书架页尺寸。 */
	limit: number;
	/** 完整替换 URL 查询状态，未传字段会清除，不按增量合并。 */
	onSearchChange: (search: BlogSearch) => void;
}

/** 加载占位仅覆盖内容槽，外部标题与工具栏持续可操作。 */
export function BlogPending() {
	return (
		<div role="status" aria-label="正在加载内容" aria-busy="true" className="space-y-4">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-40 rounded-xl" />
		</div>
	);
}

/** 使用路由预取的查询缓存，视图变化不重建外层博客工具栏。 */
export function BlogResults({ view, search, limit, onSearchChange }: BlogResultsProps) {
	const page = search.page ?? 1;
	const filter = { tag: search.tag, source: search.source };
	const postQuery = { ...filter, page, limit };
	const seriesQuery = { ...filter, page, limit: BLOG_SERIES_PAGE_SIZE };
	const posts = useQuery({
		queryKey: postKeys.list(postQuery),
		queryFn: () => fetchPosts(postQuery),
		enabled: view === "posts",
	});
	const series = useQuery({
		queryKey: seriesKeys.list(seriesQuery),
		queryFn: () => fetchSeries(seriesQuery),
		enabled: view === "series",
	});
	const selected = view === "series" ? series : posts;
	const items = selected.data?.data ?? [];
	const totalPages = selected.data?.pagination.total_pages ?? 1;
	const total = selected.data?.pagination.total;
	const filtered = !!(search.tag || search.source);

	if (view === "archive") return <ArchiveBrowse filter={filter} />;
	return (
		<>
			{total !== undefined ? (
				<p
					role="status"
					className="mb-5 flex min-h-8 items-center text-sm text-muted-foreground"
				>
					共 {total} {view === "series" ? "个系列" : "篇文章"}
					{view === "series" && filtered ? " · 包含匹配文章" : ""}
				</p>
			) : null}
			{selected.isLoading ? (
				<BlogPending />
			) : selected.isError ? (
				<Empty
					title="内容暂时加载失败"
					description="可以重试，当前视图与筛选会保留。"
					action={<Button onClick={() => void selected.refetch()}>重试</Button>}
				/>
			) : !items.length ? (
				<Empty
					title={
						page > 1
							? "这一页没有内容"
							: filtered
								? "没有匹配的内容"
								: view === "series"
									? "暂无系列"
									: "暂无文章"
					}
					description={
						page > 1
							? "可以回到第一页继续浏览。"
							: filtered
								? "试试其他标签或文章来源。"
								: "已发布的内容会出现在这里。"
					}
					action={
						page > 1 ? (
							<Button onClick={() => onSearchChange({ ...search, page: undefined })}>
								返回第一页
							</Button>
						) : undefined
					}
				/>
			) : (
				<>
					{view === "series" ? (
						<SeriesShelf books={series.data?.data ?? []} />
					) : (
						<BlogPostGrid
							posts={posts.data?.data ?? []}
							highlightFeatured={page === 1}
						/>
					)}
					<Pagination
						className="mt-10"
						page={page}
						totalPages={totalPages}
						onPageChange={(nextPage) =>
							onSearchChange({
								...search,
								page: nextPage === 1 ? undefined : nextPage,
							})
						}
					/>
				</>
			)}
		</>
	);
}
