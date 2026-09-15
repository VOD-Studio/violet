import { useMe } from "@features/auth/api/queries";
import { fetchFriendLinks } from "@features/friend-links/api/client";
import { friendLinkPublicKeys } from "@features/friend-links/api/keys";
import { useFriendLinks } from "@features/friend-links/api/queries";
import { ApplyDialog } from "@features/friend-links/ui/ApplyDialog";
import { FriendsSkeleton } from "@features/friend-links/ui/FriendsSkeleton";
import { PostcardWall } from "@features/friend-links/ui/PostcardWall";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageHeader } from "@shared/ui/page-header";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";

/**
 * /friends - 友链公开页（issue #162 / F3）
 *
 * 视觉语言对齐全站内容页：mono eyebrow + 大标题 + 申请按钮右对齐，
 * 明信片墙（users lab 选定方向）展示已审核友链；
 * 空态走 shared Empty 解密标题范式。
 */
function FriendsPage() {
	const { data: links, isLoading, error } = useFriendLinks();
	const { data: user } = useMe({ enabled: true });
	const isLoggedIn = !!user;
	const currentUsername = user?.username;
	const [applyOpen, setApplyOpen] = useState(false);
	// 空态自带「递出第一张名片」主行动作，此时常驻入口收敛掉，避免同屏双入口
	const isEmpty = !isLoading && !error && (!links || links.length === 0);

	return (
		<PageShell>
			<PageHeader
				eyebrow="Friends"
				title="友链"
				action={
					!isEmpty ? (
						<Button variant="outline" onClick={() => setApplyOpen(true)}>
							<Plus className="size-4" />
							申请友链
						</Button>
					) : null
				}
			/>

			{isLoading ? (
				<FriendsSkeleton />
			) : error ? (
				<p className="text-muted-foreground">加载失败</p>
			) : !links || links.length === 0 ? (
				<Empty
					size="lg"
					title="NO LINKS YET"
					description="还没有互换任何友链。递出你的名片，成为第一个。"
					action={
						<Button onClick={() => setApplyOpen(true)}>
							递出第一张名片
							<ArrowRight className="size-4" />
						</Button>
					}
					className="py-16"
				/>
			) : (
				<PostcardWall links={links} />
			)}

			<ApplyDialog
				open={applyOpen}
				onOpenChange={setApplyOpen}
				isLoggedIn={isLoggedIn}
				currentUsername={currentUsername}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/friends")({
	// SSR 预取公开列表，脱水合后首屏直出
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: friendLinkPublicKeys.list(),
			queryFn: fetchFriendLinks,
		});
	},
	component: FriendsPage,
});
