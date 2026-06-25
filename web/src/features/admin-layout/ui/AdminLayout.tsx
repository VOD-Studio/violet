import { AdminHeader } from "./AdminHeader";
import { AdminNav } from "./AdminNav";

/**
 * AdminLayout - 后台管理布局
 *
 * 左侧固定侧边栏（桌面），右侧为顶部条 + 主内容滚动区。
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col md:flex-row">
			{/* 桌面侧边栏 */}
			<aside className="hidden w-64 shrink-0 flex-col border-r border-edge-hairline bg-card md:flex">
				<div className="flex h-14 items-center border-b border-edge-hairline px-4 font-mono text-lg font-bold">
					Admin
				</div>
				<div className="p-3">
					<AdminNav />
				</div>
			</aside>

			{/* 主内容区 */}
			<div className="flex flex-1 flex-col overflow-hidden">
				<AdminHeader />
				<main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
			</div>
		</div>
	);
}
