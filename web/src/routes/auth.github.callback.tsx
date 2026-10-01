import { authKeys } from "@features/auth/api/keys";
import { useBindConnectionMutation, useGithubLoginMutation } from "@features/auth/api/mutations";
import { openLinkConfirmFromError } from "@features/auth/lib/open-link-confirm";
import { GITHUB_BIND_INTENT_KEY } from "@features/profile/ui/ConnectionsSection";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
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
	const { mutateAsync: githubLogin } = useGithubLoginMutation();
	const { mutateAsync: bindConnection } = useBindConnectionMutation();
	const qc = useQueryClient();
	const navigate = useNavigate();
	const handledCode = useRef<string | null>(null);
	const isMounted = useRef(false);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		if (!code) {
			toast.error("未获取到授权码");
			navigate({ to: "/login", replace: true });
			return;
		}

		// 授权码只消费一次，StrictMode 重放 Effect 时也不能重发或改走登录。
		if (handledCode.current === code) return;
		handledCode.current = code;

		// 设置页发起的绑定流程：清除意图标记后走 bind 而非 login
		const isBindIntent = window.sessionStorage.getItem(GITHUB_BIND_INTENT_KEY) === "1";
		window.sessionStorage.removeItem(GITHUB_BIND_INTENT_KEY);

		if (isBindIntent) {
			// Promise 回调不依赖 mutation 订阅，StrictMode 清理订阅后仍可处理结果。
			void bindConnection({ provider: "github", credential: code }).then(
				() => {
					if (!isMounted.current || handledCode.current !== code) return;
					toast.success("GitHub 绑定成功");
					qc.invalidateQueries({ queryKey: authKeys.me() });
					navigate({ to: "/profile", replace: true });
				},
				(err: unknown) => {
					if (!isMounted.current || handledCode.current !== code) return;
					toast.error(
						`GitHub 绑定失败：${err instanceof Error ? err.message : "请重试"}`,
					);
					navigate({ to: "/profile", replace: true });
				},
			);
			return;
		}

		void githubLogin(code).then(
			() => {
				if (!isMounted.current || handledCode.current !== code) return;
				toast.success("登录成功");
				// useGithubLoginMutation 的 onSuccess 已 invalidate authKeys.me() 并
				// markSessionActive()，新页面加载时 Header 会自动拉取一次 me。
				navigate({ to: "/", replace: true });
			},
			(err: unknown) => {
				if (!isMounted.current || handledCode.current !== code) return;
				if (openLinkConfirmFromError(err)) {
					// 确认弹窗全局挂载；背景落登录页而非首页，避免「未操作却被
					// 跳走」的错觉，用户取消弹窗后也能原地换登录方式重试
					navigate({ to: "/login", replace: true });
					return;
				}
				toast.error("GitHub 登录失败");
				navigate({ to: "/login", replace: true });
			},
		);
	}, [code, githubLogin, bindConnection, qc, navigate]);

	return (
		<div className="flex h-screen w-screen items-center justify-center">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="size-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">正在处理 GitHub 授权...</p>
			</div>
		</div>
	);
}
