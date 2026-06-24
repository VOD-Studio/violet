import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { AvatarUploader } from "@/features/upload/ui/AvatarUploader";

/**
 * ProfilePage - 个人中心
 *
 * 首期实装头像上传(走分片上传链路:秒传/单分片/WebP 转码)。
 * 后续可扩展个人资料编辑、密码修改等。
 */
function ProfilePage() {
	// 上传成功后 invalidate 路由,触发 __root beforeLoad 重新拉 /auth/me 更新头像
	const router = useRouter();

	return (
		<ProfileContent
			onUploaded={() => {
				void router.invalidate();
			}}
		/>
	);
}

function ProfileContent({ onUploaded }: { onUploaded: () => void }) {
	const user = Route.useRouteContext().auth.user;

	if (!user) {
		// 正常不会到这(beforeLoad 已拦截未登录),防御性处理
		return <ComingSoon title="个人中心" />;
	}

	return (
		<div className="mx-auto max-w-md py-12">
			<h1 className="mb-6 text-2xl font-bold">个人中心</h1>
			<div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
				<AvatarUploader user={user} onUploaded={onUploaded} />
				<dl className="mt-6 space-y-2 text-sm">
					<div className="flex justify-between">
						<dt className="text-gray-500 dark:text-gray-400">用户名</dt>
						<dd>{user.username}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-gray-500 dark:text-gray-400">邮箱</dt>
						<dd>{user.email}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-gray-500 dark:text-gray-400">角色</dt>
						<dd>{user.role}</dd>
					</div>
				</dl>
			</div>
		</div>
	);
}

/**
 * /profile - 个人中心（需登录）
 *
 * beforeLoad 在 SSR 期间即可根据 context.auth 重定向到 /login，
 * 不必等客户端 hydrate 才发现未登录（避免闪烁/二次跳转）。
 */
export const Route = createFileRoute("/profile/")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
	},
	component: ProfilePage,
});
