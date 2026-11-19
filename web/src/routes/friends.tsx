import { useMe } from "@features/auth/api/queries";
import { fetchFriendLinkPage } from "@features/friend-links/api/client";
import { friendLinkPublicKeys } from "@features/friend-links/api/keys";
import { useFriendLinkPage } from "@features/friend-links/api/queries";
import { ApplyForm } from "@features/friend-links/ui/ApplyForm";
import { ExchangeIdentity } from "@features/friend-links/ui/ExchangeIdentity";
import { FriendGrid } from "@features/friend-links/ui/FriendGrid";
import { FriendsSkeleton } from "@features/friend-links/ui/FriendsSkeleton";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings, useSettings } from "@features/settings/api/queries";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, PageShell, Pagination } from "@violet/ui";
import { Plus } from "lucide-react";

function FriendsPage() {
	const { page, sort } = Route.useSearch();
	const navigate = Route.useNavigate();
	const query = { page, sort, limit: 9 };
	const { data, isLoading, error, refetch } = useFriendLinkPage(query);
	const { data: settings, error: settingsError } = useSettings();
	const { data: user } = useMe({ enabled: true });
	const links = data?.data ?? [];
	const total = data?.pagination.total;
	const totalPages = data?.pagination.total_pages ?? 0;
	return (
		<PageShell className="max-w-292 lg:pt-16.5">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-serif text-4xl leading-[1.15] font-semibold md:text-[3.25rem]">
						友链
					</h1>
					<p className="mt-3 text-[0.9375rem] text-muted-foreground">
						{total === undefined ? (
							"认识一些写字与做事的朋友"
						) : (
							<>
								<span className="font-mono tabular-nums">{total}</span> 位朋友，
								{sort === "manual" ? "按站长编排排序" : "按最近更新排序"}
							</>
						)}
					</p>
				</div>
				<Button variant="primary" asChild>
					<a href="#apply">
						<Plus className="size-4" aria-hidden="true" />
						申请友链
					</a>
				</Button>
			</header>
			<section aria-label="公开友链" className="mt-10">
				{isLoading ? (
					<FriendsSkeleton />
				) : error ? (
					<Empty
						title="友链加载失败"
						description={error.message}
						action={<Button onClick={() => void refetch()}>重新加载</Button>}
					/>
				) : links.length === 0 ? (
					<Empty
						title={total ? "这一页没有友链" : "还没有公开友链"}
						description={
							total
								? "回到第一页，继续认识这里的朋友。"
								: "申请交换友链，审核通过后会出现在这里。"
						}
						action={
							total ? (
								<Button
									onClick={() => void navigate({ search: { page: 1, sort } })}
								>
									回到第一页
								</Button>
							) : undefined
						}
					/>
				) : (
					<FriendGrid links={links} />
				)}
				{totalPages > 1 ? (
					<div className="mt-8 flex flex-col items-center gap-5">
						{page === 1 ? (
							<Button asChild>
								<Link to="/friends" search={{ page: 2, sort }}>
									看全部 {total} 位朋友
								</Link>
							</Button>
						) : null}
						<Pagination
							aria-label="友链分页"
							page={page}
							totalPages={totalPages}
							onPageChange={(next) => void navigate({ search: { page: next, sort } })}
						/>
					</div>
				) : null}
			</section>
			<section
				id="apply"
				tabIndex={-1}
				aria-labelledby="exchange-title"
				className="mt-24 grid scroll-mt-24 gap-10 border-t border-border pt-14 lg:grid-cols-2 lg:gap-14"
			>
				<div>
					<h2 id="exchange-title" className="font-serif text-[1.625rem] font-semibold">
						交换友链
					</h2>
					<p className="mt-3 text-sm leading-8 text-muted-foreground">
						先把本站加到你的友链里，再填写申请。留下 RSS，你的最新文章会显示在卡片上。
					</p>
					{settings ? (
						<ExchangeIdentity settings={settings} />
					) : (
						<p role="status" className="mt-7 text-sm text-muted-foreground">
							{settingsError
								? "本站信息暂时无法加载，请稍后刷新。"
								: "正在加载本站信息…"}
						</p>
					)}
				</div>
				<ApplyForm isLoggedIn={!!user} username={user?.username} />
			</section>
		</PageShell>
	);
}

export const Route = createFileRoute("/friends")({
	validateSearch: (search: Record<string, unknown>) => {
		const value = Number(search.page);
		return {
			page: Number.isSafeInteger(value) && value > 0 ? value : 1,
			sort: search.sort === "manual" ? ("manual" as const) : ("updated" as const),
		};
	},
	loaderDeps: ({ search }) => ({ page: search.page, sort: search.sort }),
	loader: async ({ context, deps }) => {
		const query = { ...deps, limit: 9 };
		await Promise.allSettled([
			context.queryClient.ensureQueryData({
				queryKey: friendLinkPublicKeys.list(query),
				queryFn: () => fetchFriendLinkPage(query),
			}),
			context.queryClient.ensureQueryData({
				queryKey: settingsKeys.public(),
				queryFn: fetchSettings,
			}),
		]);
	},
	component: FriendsPage,
});
