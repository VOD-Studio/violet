import { usePendingFriendLinkCount } from "../api/queries";

/**
 * FriendLinkNavBadge - 后台菜单「友链管理」项的待审核计数角标
 *
 * 由 nav-menu-config 挂到菜单项上（NavMenuItem.badge），在 NavMenuLink 内渲染。
 * count > 0 才显示；展开态为计数胶囊，collapsed（侧边栏收起）退化为红点。
 *
 * 不复用 shared/ui/pending-badge：那是评论区「审批中」文字徽章（show 布尔、
 * 无计数语义），与菜单数字角标是两个组件。
 */
export function FriendLinkNavBadge({ collapsed }: { collapsed?: boolean }) {
	const { data } = usePendingFriendLinkCount();
	const count = data?.count ?? 0;
	if (count <= 0) return null;

	if (collapsed) {
		return (
			<span
				className="absolute right-1 top-1 size-2 rounded-full bg-destructive"
				title={`${count} 条待审核友链`}
			/>
		);
	}
	return (
		<span
			className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground"
			title={`${count} 条待审核友链`}
		>
			{count > 99 ? "99+" : count}
		</span>
	);
}
