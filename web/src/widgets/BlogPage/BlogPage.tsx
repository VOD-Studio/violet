import { usePostTags } from "@features/posts/api/queries";
import { Link } from "@tanstack/react-router";
import {
	Button,
	PageHeader,
	PageShell,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import type { ReactNode } from "react";
import { BLOG_VIEW_PATHS, type BlogSearch, type BlogView } from "./lib/search";

/** 视图与筛选始终来自路由，组件不保存第二份选择状态。 */
export interface BlogPageProps {
	view: BlogView;
	search: BlogSearch;
	children: ReactNode;
	/** 由路由写入浏览历史；筛选和视图变化时调用方重置页码。 */
	onSearchChange: (search: BlogSearch) => void;
}

const views: { value: BlogView; label: string }[] = [
	{ value: "posts", label: "文章" },
	{ value: "series", label: "系列" },
	{ value: "archive", label: "归档" },
];

/** 博客三个浏览视图的持续布局，由子路由提供内容区。 */
export function BlogPage({ view, search, children, onSearchChange }: BlogPageProps) {
	const tags = usePostTags({ source: search.source });
	const tagOptions = tags.data ?? [];
	const unknownTag = search.tag && !tagOptions.some((tag) => tag.slug === search.tag);
	const filtered = !!(search.tag || search.source);
	const clear = () => onSearchChange({});

	return (
		<PageShell className="max-w-292 md:pt-14">
			<div className="mb-8 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<PageHeader title="博客" className="mb-0 shrink-0" />
				<div className="flex min-w-0 flex-wrap items-center gap-3">
					<Segmented
						value={view}
						aria-label="博客视图"
						rounded="full"
						segments={views.map((item) => ({
							...item,
							render: (props, state) => (
								<Link
									{...props}
									to={BLOG_VIEW_PATHS[item.value]}
									search={{
										...search,
										source:
											item.value === "archive" ? undefined : search.source,
										page: undefined,
									}}
									aria-current={state.active ? "page" : undefined}
									activeOptions={{ exact: true, includeSearch: true }}
									resetScroll={false}
								/>
							),
						}))}
					/>
					<div className="flex min-h-8 w-66 items-center gap-2">
						<Select
							value={search.tag ?? ""}
							onValueChange={(tag) =>
								onSearchChange({
									...search,
									tag: tag || undefined,
									page: undefined,
								})
							}
							disabled={tags.isLoading || tags.isError}
						>
							<SelectTrigger aria-label="文章标签" controlSize="sm" className="w-36">
								<SelectValue
									placeholder={tags.isError ? "标签加载失败" : "全部标签"}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">全部标签</SelectItem>
								{unknownTag ? (
									<SelectItem value={search.tag ?? ""}>{search.tag}</SelectItem>
								) : null}
								{tagOptions.map((tag) => (
									<SelectItem
										key={tag.slug}
										value={tag.slug}
										textValue={tag.name}
										meta={`${tag.count} 篇`}
									>
										{tag.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{view !== "archive" ? (
							<Select
								value={search.source ?? "all"}
								onValueChange={(source) =>
									onSearchChange({
										...search,
										source:
											source === "original" || source === "repost"
												? source
												: undefined,
										page: undefined,
									})
								}
							>
								<SelectTrigger
									aria-label="文章来源"
									controlSize="sm"
									className="w-28"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部来源</SelectItem>
									<SelectItem value="original">原创</SelectItem>
									<SelectItem value="repost">转载</SelectItem>
								</SelectContent>
							</Select>
						) : null}
					</div>
				</div>
			</div>
			{filtered || tags.isError ? (
				<div className="mb-5 flex min-h-8 flex-wrap items-center gap-3 text-sm text-muted-foreground">
					{filtered ? (
						<Button variant="ghost" size="sm" onClick={clear}>
							清除筛选
						</Button>
					) : null}
					{tags.isError ? (
						<Button variant="ghost" size="sm" onClick={() => void tags.refetch()}>
							重试标签
						</Button>
					) : null}
				</div>
			) : null}
			{children}
		</PageShell>
	);
}
