import { useGoogleLoginMutation, useLogin } from "@features/auth/api/mutations";
import { clearAuthCache, useCsrfToken } from "@features/auth/api/queries";
import { useOAuthVisibility } from "@features/auth/hooks/use-oauth-visibility";
import type { LoginRequest } from "@features/auth/model/types";
import { useGoogleLogin } from "@react-oauth/google";
import { ApiError } from "@shared/api/error";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { clearSessionActive } from "@shared/api/session";
import { Button } from "@shared/ui/base/button";
import { GithubIcon, GoogleIcon } from "@shared/ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import { Modal } from "@/shared/ui/modal";

/**
 * 后端未返回 message 时的兜底文案（按状态码）。与 /login 页面保持一致。
 */
const FALLBACK_BY_STATUS: Record<number, string> = {
	401: "账号或密码错误",
	403: "账户不可用，请联系管理员",
	429: "请求过于频繁，请稍后再试",
};

/**
 * LoginDialog - 全局登录弹窗
 *
 * 触发路径：
 * 1. 用户主动点击 Header 的「登录」按钮
 * 2. http 拦截器收到非主动认证请求的 401 时自动弹窗
 *
 * 取消时：清会话状态并移除 me 缓存；若当前在受保护页则回首页。
 */
export function LoginDialog() {
	const isOpen = useLoginDialogStore((s) => s.isOpen);
	const open = useLoginDialogStore((s) => s.open);
	const close = useLoginDialogStore((s) => s.close);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const qc = useQueryClient();
	const csrfToken = useCsrfToken({ enabled: isOpen });
	const login = useLogin();
	const googleLogin = useGoogleLoginMutation(csrfToken);
	const { showGoogle, showGithub, showOAuth, githubClientId } = useOAuthVisibility();

	// 弹窗打开时如果用户已手动登录（Header 按钮触发时 sessionActive 可能为 true），
	// 保持原有语义：登录成功后仅 close。
	const handleGoogleLogin = useGoogleLogin({
		flow: "implicit",
		onSuccess: (tokenResponse) => {
			googleLogin.mutate(tokenResponse.access_token, {
				onSuccess: () => {
					toast.success("登录成功");
					close();
					setForm({ identifier: "", password: "" });
					// useGoogleLoginMutation 的 onSuccess 已 invalidate authKeys.me()
					// 并 markSessionActive()，Header 等观察者会自动拉取一次 me。
					// 这里不再显式 refetch，避免与 mutation 的 invalidate 产生双发。
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message ||
								FALLBACK_BY_STATUS[err.status] ||
								"登录失败，请稍后再试"
							: err.message || "登录失败，请检查网络";
					toast.error(msg);
				},
			});
		},
		onError: () => toast.error("Google 登录失败，请重试"),
	});

	const handleGithubLogin = () => {
		const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
		const clientId = githubClientId || import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) return;
		window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;
	};

	const [form, setForm] = useState<LoginRequest>({ identifier: "", password: "" });
	const [errors, setErrors] = useState<Partial<Record<keyof LoginRequest, string>>>({});

	const validate = (): boolean => {
		const next: typeof errors = {};
		if (!form.identifier) {
			next.identifier = "请输入账号";
		}
		if (!form.password || form.password.length < 8) {
			next.password = "密码至少 8 位";
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		login.mutate(form, {
			onSuccess: () => {
				toast.success("登录成功");
				close();
				setForm({ identifier: "", password: "" });
				// useLogin 的 onSuccess 已 invalidate authKeys.me() 并 markSessionActive()，
				// Header 等观察者会自动拉取一次 me。这里不再显式 refetch，避免双发。
			},
			onError: (err) => {
				const msg =
					err instanceof ApiError
						? err.message || FALLBACK_BY_STATUS[err.status] || "登录失败，请稍后再试"
						: err.message || "登录失败，请检查账号和密码";
				toast.error(msg);
			},
		});
	};

	const handleOpenChange = async (next: boolean) => {
		if (next) {
			open();
			return;
		}
		// 用户取消/关闭弹窗：清会话状态（me + csrf + sessionActive），让守卫允许跳转登录页。
		// 复用 clearAuthCache（与 useLogout 同一逻辑），补上历史遗漏的 csrf-token 清理。
		clearAuthCache(qc);
		clearSessionActive();
		close();
		setForm((f) => ({ ...f, password: "" }));

		// 在受保护页（profile/admin）取消重登 → 回首页
		const needsAuth = pathname.startsWith("/profile") || pathname.startsWith("/admin");
		if (needsAuth) {
			navigate({ to: "/", replace: true }).catch(() => {});
		}
	};

	return (
		<Modal
			open={isOpen}
			onOpenChange={handleOpenChange}
			title="重新登录"
			description="登录状态已失效，请重新登录后继续。"
			size="sm"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={login.isPending || googleLogin.isPending}
					>
						取消
					</Button>
					<Button
						type="submit"
						form="login-dialog-form"
						disabled={login.isPending || googleLogin.isPending || !csrfToken}
					>
						{(login.isPending || googleLogin.isPending) && (
							<Loader2 className="mr-2 size-4 animate-spin" />
						)}
						{login.isPending || googleLogin.isPending ? "登录中…" : "登录"}
					</Button>
				</>
			}
		>
			<form id="login-dialog-form" onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="login-dialog-identifier">账号</Label>
					<Input
						id="login-dialog-identifier"
						type="text"
						placeholder="用户名或邮箱"
						value={form.identifier}
						onChange={(e) => setForm({ ...form, identifier: e.target.value })}
						aria-invalid={!!errors.identifier}
						autoComplete="username"
					/>
					{errors.identifier ? (
						<p className="text-sm text-destructive">{errors.identifier}</p>
					) : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor="login-dialog-password">密码</Label>
					<Input
						id="login-dialog-password"
						type="password"
						placeholder="••••••••"
						value={form.password}
						onChange={(e) => setForm({ ...form, password: e.target.value })}
						aria-invalid={!!errors.password}
						autoComplete="current-password"
					/>
					{errors.password ? (
						<p className="text-sm text-destructive">{errors.password}</p>
					) : null}
				</div>

				{showOAuth ? (
					<>
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">
									或者
								</span>
							</div>
						</div>

						<div className="flex justify-center">
							{showGoogle ? (
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-12 rounded-full"
									onClick={() => handleGoogleLogin()}
									disabled={googleLogin.isPending}
								>
									<GoogleIcon title="Google" className="size-6" />
								</Button>
							) : null}
							{showGithub ? (
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="ml-4 size-12 rounded-full"
									onClick={() => handleGithubLogin()}
								>
									<GithubIcon title="GitHub" className="size-6" />
								</Button>
							) : null}
						</div>
					</>
				) : null}
			</form>
		</Modal>
	);
}

export default LoginDialog;
