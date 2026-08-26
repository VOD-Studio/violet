import { useAdminPosts } from "@features/admin-posts/api/queries";
import type { AdminPostListItem } from "@features/admin-posts/model/types";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/base/dialog";
import { Skeleton } from "@shared/ui/base/skeleton";
import { SearchInput } from "@shared/ui/search-input";
import { useEffect, useState } from "react";

interface PostPickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 已在书内的文章 ID（禁选，防重复挂章请求被拒） */
	excludeIds: Set<string>;
	/** 确认挂章：按列表顺序回传选中文章 */
	onConfirm: (posts: AdminPostListItem[]) => void;
	/** 挂章请求 pending 态 */
	loading?: boolean;
}

const PAGE_LIMIT = 10;

/** 从已有文章多选挂章弹窗：搜索 + 顺序多选（点选顺序即挂入顺序，跨页保持选中）。 */
export function PostPickerDialog({
	open,
	onOpenChange,
	excludeIds,
	onConfirm,
	loading,
}: PostPickerDialogProps) {
	const [keyword, setKeyword] = useState("");
	const [page, setPage] = useState(1);
	// 点选顺序即挂入顺序（post_ids 语义）；picked 携带完整快照，
	// 翻页后当前页数据不含旧选项，不能只依赖当前页映射
	const [picked, setPicked] = useState<AdminPostListItem[]>([]);

	const { data, isLoading } = useAdminPosts({
		keyword: keyword || undefined,
		page,
		limit: PAGE_LIMIT,
	});
	const posts = data?.data ?? [];
	const total = data?.pagination?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

	useEffect(() => {
		if (open) {
			setPicked([]);
			setKeyword("");
			setPage(1);
		}
	}, [open]);

	const toggle = (post: AdminPostListItem) => {
		setPicked((prev) =>
			prev.some((p) => p.id === post.id)
				? prev.filter((p) => p.id !== post.id)
				: [...prev, post],
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[80vh] flex-col sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>挂入章节</DialogTitle>
					<DialogDescription>点选顺序即挂入顺序；只能挂自己的文章</DialogDescription>
				</DialogHeader>
				<SearchInput
					value={keyword}
					onValueChange={setKeyword}
					onSearch={(v) => {
						setKeyword(v);
						setPage(1);
					}}
					placeholder="搜索文章标题"
				/>
				<div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
					{isLoading ? (
						<div className="space-y-1">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					) : posts.length === 0 ? (
						<p className="text-muted-foreground py-8 text-center text-sm">
							没有匹配的文章
						</p>
					) : (
						posts.map((post) => {
							const excluded = excludeIds.has(post.id);
							const order = picked.findIndex((p) => p.id === post.id);
							const checked = order >= 0;
							return (
								<button
									key={post.id}
									type="button"
									disabled={excluded}
									onClick={() => toggle(post)}
									className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors ${
										excluded
											? "border-edge-hairline opacity-40"
											: checked
												? "border-primary bg-primary/5"
												: "border-edge-hairline hover:bg-muted/50"
									}`}
								>
									<span
										className={`flex size-5 shrink-0 items-center justify-center rounded border font-mono text-xs ${
											checked
												? "border-primary bg-primary text-primary-foreground"
												: "border-edge-hairline"
										}`}
									>
										{checked ? order + 1 : ""}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium">
											{post.title}
										</span>
										<span className="text-muted-foreground block truncate font-mono text-xs">
											{post.slug}
										</span>
									</span>
									{excluded ? (
										<Badge variant="secondary">已在书内</Badge>
									) : (
										<Badge
											variant={
												post.status === "published" ? "default" : "outline"
											}
										>
											{post.status === "published"
												? "已发布"
												: post.status === "draft"
													? "草稿"
													: "已归档"}
										</Badge>
									)}
								</button>
							);
						})
					)}
				</div>
				<div className="flex items-center justify-between gap-2">
					<span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
						已选 {picked.length} 章
						{picked.length > 0 ? `：${picked.map((p) => p.title).join("、")}` : ""}
					</span>
					{total > PAGE_LIMIT && (
						<span className="flex shrink-0 items-center gap-2 text-xs">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								上一页
							</Button>
							<span className="font-mono">
								{page} / {totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								下一页
							</Button>
						</span>
					)}
				</div>
				<DialogFooter>
					<Button
						type="button"
						disabled={picked.length === 0 || loading}
						onClick={() => onConfirm(picked)}
					>
						{loading ? "挂入中…" : `挂入 ${picked.length} 章`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
