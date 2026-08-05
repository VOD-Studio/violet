import { PageShell } from "@features/admin-layout/ui/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/ui/base/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Smile, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/admin/")({
	component: AdminIndex,
});

function AdminIndex() {
	return (
		<PageShell title="概览">
			<div className="space-y-6">
				{/* 统计卡片区 */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{/* 总用户数 */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">总用户数</CardTitle>
							<Users className="text-muted-foreground size-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">47</div>
							<p className="text-muted-foreground text-xs">平台注册用户总数</p>
						</CardContent>
					</Card>

					{/* 表情分组数 */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">表情分组数</CardTitle>
							<TrendingUp className="text-muted-foreground size-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">8</div>
							<p className="text-muted-foreground text-xs">已创建的表情分组</p>
						</CardContent>
					</Card>

					{/* 已启用表情 */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">已启用表情</CardTitle>
							<Smile className="text-muted-foreground size-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">156</div>
							<p className="text-muted-foreground text-xs">当前可用表情数量</p>
						</CardContent>
					</Card>
				</div>

				{/* 快捷操作区 */}
				<div>
					<h2 className="mb-4 text-lg font-semibold">快捷操作</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						{/* 用户管理入口 */}
						<Link to="/admin/users">
							<Card className="transition-colors hover:bg-accent cursor-pointer">
								<CardHeader>
									<div className="flex items-center gap-3">
										<div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
											<Users className="size-5" />
										</div>
										<div className="flex-1">
											<CardTitle className="text-base">用户管理</CardTitle>
											<CardDescription className="mt-1">
												管理平台用户账号和权限
											</CardDescription>
										</div>
										<ArrowRight className="text-muted-foreground size-4" />
									</div>
								</CardHeader>
							</Card>
						</Link>

						{/* 表情管理入口 */}
						<Link to="/admin/emojis">
							<Card className="transition-colors hover:bg-accent cursor-pointer">
								<CardHeader>
									<div className="flex items-center gap-3">
										<div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
											<Smile className="size-5" />
										</div>
										<div className="flex-1">
											<CardTitle className="text-base">表情管理</CardTitle>
											<CardDescription className="mt-1">
												管理表情分组和表情内容
											</CardDescription>
										</div>
										<ArrowRight className="text-muted-foreground size-4" />
									</div>
								</CardHeader>
							</Card>
						</Link>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
