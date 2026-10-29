import { useMe } from "@features/auth/api/queries";
import { requireLogin } from "@features/auth/lib/require-login";
import { UsageSection } from "@features/profile/ui/UsageSection";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, PageShell } from "@violet/ui";
import { ArrowLeft } from "lucide-react";

/**
 * /users/$username/usage - 个人 OMP 用量（仅本人）
 *
 * 用量接口只返回当前会话账号的数据，路径中的用户名与登录用户不一致时按未找到处理。
 */
function UserUsagePage() {
	const { username } = Route.useParams();
	const { data: me } = useMe();

	if (!me) {
		return null; // beforeLoad 已拦截未登录
	}

	if (me.username !== username) {
		return (
			<PageShell>
				<div
					role="status"
					className="mx-auto flex max-w-md flex-col items-center gap-2 py-24 text-center"
				>
					<h1 className="text-2xl font-bold tracking-tight">未找到页面</h1>
					<p className="text-sm text-muted-foreground">该页面不存在或你没有访问权限。</p>
					<Button className="mt-4" asChild>
						<Link to="/">返回主页</Link>
					</Button>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<div className="mx-auto w-full max-w-5xl space-y-6 px-1">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/users/$username" params={{ username }}>
						<ArrowLeft className="size-4" />
						返回主页
					</Link>
				</Button>
				<UsageSection />
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/users/$username/usage")({
	ssr: false,
	beforeLoad: requireLogin,
	head: () => ({ meta: [{ title: "用量" }] }),
	component: UserUsagePage,
});
