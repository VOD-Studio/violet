import {
	useGithubLoginMutation,
	useGoogleLoginMutation,
	useLogin,
} from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useGithubOAuth } from "@features/auth/hooks/use-github-oauth";
import { useOAuthVisibility } from "@features/auth/hooks/use-oauth-visibility";
import { openLinkConfirmFromError } from "@features/auth/lib/open-link-confirm";
import type { LoginRequest } from "@features/auth/model/types";
import { useGoogleLogin } from "@react-oauth/google";
import { ApiError } from "@shared/api/error";
import { toast } from "sonner";

/** 后端未返回 message 时的兜底文案（按状态码） */
const FALLBACK_BY_STATUS: Record<number, string> = {
	401: "账号或密码错误",
	403: "账户不可用，请联系管理员",
	429: "请求过于频繁，请稍后再试",
};

function toastLoginError(err: unknown, fallback: string): void {
	if (openLinkConfirmFromError(err)) return;
	toast.error(
		err instanceof ApiError
			? err.message || FALLBACK_BY_STATUS[err.status] || fallback
			: err instanceof Error
				? err.message || "登录失败，请检查网络"
				: fallback,
	);
}

export interface UseLoginFlowsOptions {
	/** 任一方式登录成功后调用；me 查询的刷新与会话标记已由各 mutation 的 onSuccess 完成 */
	onSuccess: () => void;
	/** 是否预取 CSRF token（弹窗未打开时不需要） */
	enabled?: boolean;
}

/**
 * 三种登录方式（Google、GitHub、账号密码）的统一流程，登录弹窗与内嵌登录共用。
 *
 * @returns 各方式的发起函数、进行中状态与第三方登录可见性
 */
export function useLoginFlows({ onSuccess, enabled = true }: UseLoginFlowsOptions) {
	const csrfToken = useCsrfToken({ enabled });
	const login = useLogin();
	const googleLogin = useGoogleLoginMutation(csrfToken);
	const githubLogin = useGithubLoginMutation(csrfToken);
	const visibility = useOAuthVisibility();

	const done = () => {
		toast.success("登录成功");
		onSuccess();
	};

	const startGoogle = useGoogleLogin({
		flow: "implicit",
		onSuccess: (tokenResponse) => {
			googleLogin.mutate(tokenResponse.access_token, {
				onSuccess: done,
				onError: (err) => toastLoginError(err, "登录失败，请稍后再试"),
			});
		},
		onError: () => toast.error("Google 登录失败，请重试"),
	});

	const startGithub = useGithubOAuth({
		onCode: (code) => {
			githubLogin.mutate(code, {
				onSuccess: done,
				onError: (err) => toastLoginError(err, "登录失败，请稍后重试"),
			});
		},
	});

	const submitPassword = (form: LoginRequest) => {
		login.mutate(form, {
			onSuccess: done,
			onError: (err) => toastLoginError(err, "登录失败，请稍后再试"),
		});
	};

	return {
		csrfToken,
		startGoogle: () => startGoogle(),
		startGithub: () => startGithub(),
		submitPassword,
		passwordPending: login.isPending,
		googlePending: googleLogin.isPending,
		githubPending: githubLogin.isPending,
		...visibility,
	};
}
