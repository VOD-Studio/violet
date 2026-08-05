import { useGithubLoginMutation } from "@features/auth/api/mutations";
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
	const navigate = useNavigate();

	useEffect(() => {
		if (!code) {
			toast.error("未获取到授权码");
			navigate({ to: "/login", replace: true });
			return;
		}

		githubLogin.mutate(code, {
			onSuccess: () => {
				toast.success("登录成功");
				// useGithubLoginMutation 的 onSuccess 已 invalidate authKeys.me() 并
				// markSessionActive()，新页面加载时 Header 会自动拉取一次 me。
				navigate({ to: "/", replace: true });
			},
			onError: () => {
				toast.error("GitHub 登录失败");
				navigate({ to: "/login", replace: true });
			},
		});
	}, [code, githubLogin.mutate, navigate]);

	return (
		<div className="flex h-screen w-screen items-center justify-center">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="size-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">正在处理 GitHub 登录...</p>
			</div>
		</div>
	);
}
