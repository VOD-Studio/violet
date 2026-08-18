import { useGoogleLoginMutation, useLogin } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useOAuthVisibility } from "@features/auth/hooks/use-oauth-visibility";
import { type LoginFormData, loginSchema } from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleLogin } from "@react-oauth/google";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { GithubIcon, GoogleIcon } from "@shared/ui/icons";
import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/**
 * loginSearchSchema - 登录页 URL 查询参数
 *
 * - redirect: 登录成功后跳转的目标路径，默认回到首页。
 * - email: 预填邮箱（注册/找回密码成功后跳转时传入，省去用户重复输入）。
 */
const loginSearchSchema = z.object({
	redirect: z.string().optional().catch("/"),
	email: z.string().optional().catch(""),
});

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
	validateSearch: loginSearchSchema,
	beforeLoad: ({ context, search }) => {
		// 已登录(网络确认)则重定向到目标页,避免已登录用户看到登录页。
		// 只认 context.auth(父路由 __root.beforeLoad 已 await getAuthSession 的准确网络判定)。
		if (context.auth.isAuthenticated && context.auth.claims) {
			throw redirect({ to: search.redirect || "/", replace: true });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { redirect, email: prefilledEmail } = useSearch({ from: "/login" });
	const navigate = useNavigate();

	const {
		register: registerField,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: { identifier: prefilledEmail ?? "", password: "" },
	});

	const csrfToken = useCsrfToken();
	const login = useLogin(csrfToken);
	const googleLogin = useGoogleLoginMutation(csrfToken);
	const { showGoogle, showGithub, showOAuth, githubClientId } = useOAuthVisibility();

	const handleGoogleLogin = useGoogleLogin({
		flow: "implicit",
		onSuccess: (tokenResponse) => {
			googleLogin.mutate(tokenResponse.access_token, {
				onSuccess: async () => {
					toast.success("登录成功");
					const target = redirect || "/";
					try {
						await navigate({ to: target, replace: true });
					} catch {
						window.location.href = target;
					}
					// useGoogleLoginMutation 已 invalidate authKeys.me() 并 markSessionActive()，
					// Header 等观察者只会自动拉取一次 me，这里不再显式 refetch。
				},
				onError: (err) => {
					toast.error(err instanceof ApiError ? err.message : "登录失败");
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

	const onSubmit = handleSubmit((data) => {
		login.mutate(data, {
			onSuccess: async () => {
				toast.success("登录成功");
				const target = redirect || "/";
				try {
					await navigate({ to: target, replace: true });
				} catch {
					window.location.href = target;
				}
				// useLogin 的 onSuccess 已 invalidate authKeys.me() 并 markSessionActive()，
				// Header 等观察者会自动拉取一次 me，这里不再显式 refetch。
			},
			onError: (err) => {
				// 优先展示后端返回的具体原因（邮箱未验证 / 账户已被禁用 /
				// 请求过于频繁 / 邮箱或密码错误 等）。后端已按状态码返回明确 message，
				// 前端不再凭状态码猜文案（之前 403 一律显示「账户已被禁用」会误导未验证用户）。
				// 仅当后端没给 message 时，按状态码给兜底。
				const msg =
					err instanceof ApiError
						? err.message || FALLBACK_BY_STATUS[err.status] || "登录失败，请稍后重试"
						: err.message || "登录失败，请检查账号和密码";
				toast.error(msg);
			},
		});
	});

	return (
		<div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="font-mono text-2xl font-bold tracking-tight">登录</h1>
					<p className="mt-2 text-sm text-muted-foreground">请输入账号和密码访问后台</p>
				</div>

				<form onSubmit={onSubmit} className="space-y-4">
					<div className="space-y-1">
						<Label htmlFor="identifier">账号</Label>
						<Input
							id="identifier"
							type="text"
							placeholder="用户名或邮箱"
							autoComplete="username"
							aria-invalid={!!errors.identifier}
							{...registerField("identifier")}
						/>
						{errors.identifier ? (
							<p className="text-xs text-destructive">{errors.identifier.message}</p>
						) : null}
					</div>

					<div className="space-y-1">
						<Label htmlFor="password">密码</Label>
						<Input
							id="password"
							type="password"
							placeholder="••••••••"
							aria-invalid={!!errors.password}
							{...registerField("password")}
						/>
						{errors.password ? (
							<p className="text-xs text-destructive">{errors.password.message}</p>
						) : null}
					</div>

					<div className="flex items-center justify-between text-xs">
						<Link
							to="/register"
							className="text-muted-foreground hover:text-foreground"
						>
							没有账号？注册
						</Link>
						<Link
							to="/forgot-password"
							className="text-muted-foreground hover:text-foreground"
						>
							忘记密码？
						</Link>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={login.isPending || googleLogin.isPending || !csrfToken}
					>
						{login.isPending || googleLogin.isPending ? "登录中…" : "登录"}
					</Button>

					{showOAuth ? (
						<div className="mt-4 flex flex-col items-center gap-2">
							<div className="relative w-full">
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
						</div>
					) : null}
				</form>
			</div>
		</div>
	);
}
