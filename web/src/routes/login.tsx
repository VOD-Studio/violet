import {
	useGithubLoginMutation,
	useGoogleLoginMutation,
	useLogin,
} from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useGithubOAuth } from "@features/auth/hooks/use-github-oauth";
import { useOAuthVisibility } from "@features/auth/hooks/use-oauth-visibility";
import { parseAuthEntrySearch } from "@features/auth/lib/auth-entry-search";
import { openLinkConfirmFromError } from "@features/auth/lib/open-link-confirm";
import { safeRedirectTarget } from "@features/auth/lib/safe-redirect";
import { type LoginFormData, loginSchema } from "@features/auth/model/schemas";
import { AuthPageLayout } from "@features/auth/ui/AuthPageLayout";
import { GoogleOAuthGate } from "@features/auth/ui/GoogleOAuthGate";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleLogin, useGoogleOAuth } from "@react-oauth/google";
import { ApiError } from "@shared/api/error";
import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Field, GithubIcon, GoogleIcon, Input } from "@violet/ui";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * 后端未返回 message 时的兜底文案（按状态码）。正常路径下后端会给出
 * 明确原因（邮箱未验证 / 账户已被禁用 / 邮箱或密码错误 / 请求过于频繁等）。
 */
const FALLBACK_BY_STATUS: Record<number, string> = {
	401: "账号或密码错误",
	403: "账户不可用，请联系管理员",
	429: "请求过于频繁，请稍后再试",
};

/**
 * /login - 登录页
 *
 * useCsrfToken 自动获取 CSRF token，确保 login POST 通过 double-submit 校验。
 */
export const Route = createFileRoute("/login")({
	ssr: false,
	validateSearch: parseAuthEntrySearch,
	beforeLoad: ({ context, search }) => {
		// 已登录(网络确认)则重定向到目标页,避免已登录用户看到登录页。
		// 只认 context.auth(父路由 __root.beforeLoad 已 await getAuthSession 的准确网络判定)。
		if (context.auth.isAuthenticated && context.auth.claims) {
			throw redirect({ to: safeRedirectTarget(search.redirect), replace: true });
		}
	},
	head: () => ({ meta: [{ title: "登录" }] }),
	component: LoginPage,
});

function LoginPage() {
	const { redirect: redirectTo, email } = useSearch({ from: "/login" });
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState("");
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: { identifier: email ?? "", password: "" },
	});
	const csrfToken = useCsrfToken();
	const login = useLogin(csrfToken);
	const githubLogin = useGithubLoginMutation(csrfToken);
	const googleLogin = useGoogleLoginMutation(csrfToken);
	const { showGoogle, showGithub, showOAuth } = useOAuthVisibility();
	const submitting = login.isPending || githubLogin.isPending || googleLogin.isPending;

	async function finishLogin() {
		toast.success("登录成功");
		const target = safeRedirectTarget(redirectTo);
		try {
			await navigate({ to: target, replace: true });
		} catch {
			window.location.href = target;
		}
	}

	function reportOAuthError(error: Error) {
		if (!openLinkConfirmFromError(error)) {
			setSubmitError(error instanceof ApiError ? error.message : "第三方登录失败，请重试");
		}
	}

	const openGithub = useGithubOAuth({
		redirectTo,
		onCode: (code) => {
			githubLogin.mutate(code, { onSuccess: finishLogin, onError: reportOAuthError });
		},
	});

	const submit = handleSubmit((data) => {
		setSubmitError("");
		login.mutate(data, {
			onSuccess: finishLogin,
			onError: (error) => {
				setSubmitError(
					error instanceof ApiError
						? error.message ||
								FALLBACK_BY_STATUS[error.status] ||
								"登录失败，请稍后重试"
						: error.message || "登录失败，请检查账号和密码",
				);
			},
		});
	});

	return (
		<AuthPageLayout title="登录" description="登录后即可评论、批注和聊天。">
			{showOAuth ? (
				<div className="space-y-4">
					<div
						className={
							showGithub && showGoogle ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"
						}
					>
						{showGithub ? (
							<Button
								variant="outline"
								onClick={openGithub}
								disabled={submitting || !csrfToken}
								aria-label="使用 GitHub 登录"
								leftIcon={<GithubIcon title="GitHub" />}
							>
								GitHub
							</Button>
						) : null}
						{showGoogle ? (
							<GoogleOAuthGate>
								{(sdkError) => (
									<GoogleLoginAction
										disabled={submitting || !csrfToken}
										sdkError={sdkError}
										onToken={(token) =>
											googleLogin.mutate(token, {
												onSuccess: finishLogin,
												onError: reportOAuthError,
											})
										}
									/>
								)}
							</GoogleOAuthGate>
						) : null}
					</div>
					<p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
						或使用账号登录
					</p>
				</div>
			) : null}
			<form onSubmit={submit} className="space-y-3">
				<Field label="账号" error={errors.identifier?.message}>
					<Input
						type="text"
						placeholder="用户名或邮箱"
						autoComplete="username"
						{...register("identifier")}
					/>
				</Field>
				<Field label="密码" error={errors.password?.message}>
					<Input
						type="password"
						passwordToggle
						autoComplete="current-password"
						{...register("password")}
					/>
				</Field>
				<div className="flex justify-end">
					<Link
						to="/forgot-password"
						search={{ redirect: redirectTo, email }}
						className="text-sm text-primary hover:underline"
					>
						忘记密码？
					</Link>
				</div>
				{submitError ? (
					<p role="alert" className="text-sm text-destructive">
						{submitError}
					</p>
				) : null}
				<Button
					variant="primary"
					size="lg"
					type="submit"
					className="w-full"
					disabled={submitting || !csrfToken}
				>
					{login.isPending ? "正在登录…" : "登录"}
				</Button>
			</form>
			<p className="text-center text-sm text-muted-foreground">
				还没有账号？{" "}
				<Link
					to="/register"
					search={{ redirect: redirectTo, email }}
					className="font-semibold text-primary hover:underline"
				>
					注册
				</Link>
			</p>
		</AuthPageLayout>
	);
}

function GoogleLoginAction({
	disabled,
	onToken,
	sdkError,
}: {
	disabled: boolean;
	onToken: (token: string) => void;
	sdkError: ReactNode;
}) {
	const { scriptLoadedSuccessfully } = useGoogleOAuth();
	const openGoogle = useGoogleLogin({
		flow: "implicit",
		onSuccess: (response) => onToken(response.access_token),
		onError: () => toast.error("Google 登录失败，请重试"),
	});
	return (
		<>
			<Button
				variant="outline"
				disabled={disabled || !scriptLoadedSuccessfully}
				onClick={() => openGoogle()}
				aria-label="使用 Google 登录"
				leftIcon={<GoogleIcon title="Google" />}
			>
				Google
			</Button>
			{sdkError ? <div className="sm:col-span-full">{sdkError}</div> : null}
		</>
	);
}
