import { authKeys } from "@features/auth/api/keys";
import { useBindConnectionMutation, useGithubLoginMutation } from "@features/auth/api/mutations";
import { openLinkConfirmFromError } from "@features/auth/lib/open-link-confirm";
import { GITHUB_BIND_INTENT_KEY } from "@features/profile/ui/ConnectionsSection";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
	code: z.string().optional(),
});

export const Route = createFileRoute("/auth/github/callback")({
	validateSearch: searchSchema,
	component: GithubCallbackPage,
});

function GithubCallbackPage() {
	const { code } = useSearch({ from: "/auth/github/callback" });
	const githubLogin = useGithubLoginMutation();
	const bindConnection = useBindConnectionMutation();
	const qc = useQueryClient();
	const navigate = useNavigate();

	useEffect(() => {
		if (!code) {
			toast.error("未获取到授权码");
			navigate({ to: "/login", replace: true });
			return;
		}

		// 设置页发起的绑定流程：清除意图标记后走 bind 而非 login
		const isBindIntent = window.sessionStorage.getItem(GITHUB_BIND_INTENT_KEY) === "1";
		window.sessionStorage.removeItem(GITHUB_BIND_INTENT_KEY);

		if (isBindIntent) {
			bindConnection.mutate(
				{ provider: "github", credential: code },
				{
					onSuccess: () => {
						toast.success("GitHub 绑定成功");
						qc.invalidateQueries({ queryKey: authKeys.me() });
						navigate({ to: "/profile", replace: true });
					},
					onError: (err) => {
						toast.error(
							`GitHub 绑定失败：${err instanceof Error ? err.message : "请重试"}`,
						);
						navigate({ to: "/profile", replace: true });
					},
				},
			);
			return;
		}

		githubLogin.mutate(code, {
			onSuccess: () => {
				toast.success("登录成功");
				// useGithubLoginMutation 的 onSuccess 已 invalidate authKeys.me() 并
				// markSessionActive()，新页面加载时 Header 会自动拉取一次 me。
				navigate({ to: "/", replace: true });
			},
			onError: (err) => {
				if (openLinkConfirmFromError(err)) {
					// 确认弹窗全局挂载，回调页只负责离开 loading 界面
					navigate({ to: "/", replace: true });
					return;
				}
				toast.error("GitHub 登录失败");
				navigate({ to: "/login", replace: true });
			},
		});
	}, [code, githubLogin.mutate, bindConnection, qc, navigate]);

	return (
		<div className="flex h-screen w-screen items-center justify-center">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="size-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">正在处理 GitHub 授权...</p>
			</div>
		</div>
	);
}
