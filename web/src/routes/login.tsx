import { authKeys } from "@features/auth/api/keys";
import { useGoogleLoginMutation, useLogin } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useOAuthVisibility } from "@features/auth/lib/use-oauth-visibility";
import { type LoginFormData, loginSchema } from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleLogin } from "@react-oauth/google";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
    createFileRoute,
    Link,
    useNavigate,
    useRouteContext,
    useSearch,
} from "@tanstack/react-router";

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
    401: "邮箱或密码错误",
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
    component: LoginPage,
});

function LoginPage() {
    const { redirect, email: prefilledEmail } = useSearch({ from: "/login" });
    const navigate = useNavigate();
    const { queryClient } = useRouteContext({ from: "/login" });

    const {
        register: registerField,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: prefilledEmail ?? "", password: "" },
    });

    const csrfToken = useCsrfToken();
    const login = useLogin(csrfToken);
    const googleLogin = useGoogleLoginMutation(csrfToken);
    const { showGoogle, showGithub, showOAuth } = useOAuthVisibility();

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
                    try {
                        await queryClient.refetchQueries({ queryKey: authKeys.me() });
                    } catch {
                        // ignore
                    }
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
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email`;
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
                try {
                    await queryClient.refetchQueries({ queryKey: authKeys.me() });
                } catch {
                    // 刷新用户信息失败不影响登录后跳转；页面加载时会再次获取。
                }
            },
            onError: (err) => {
                // 优先展示后端返回的具体原因（邮箱未验证 / 账户已被禁用 /
                // 请求过于频繁 / 邮箱或密码错误 等）。后端已按状态码返回明确 message，
                // 前端不再凭状态码猜文案（之前 403 一律显示「账户已被禁用」会误导未验证用户）。
                // 仅当后端没给 message 时，按状态码给兜底。
                const msg =
                    err instanceof ApiError
                        ? err.message || FALLBACK_BY_STATUS[err.status] || "登录失败，请稍后重试"
                        : err.message || "登录失败，请检查邮箱和密码";
                toast.error(msg);
            },
        });
    });

    return (
        <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="font-mono text-2xl font-bold tracking-tight">登录</h1>
                    <p className="mt-2 text-sm text-muted-foreground">请输入邮箱和密码访问后台</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="email">邮箱</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            aria-invalid={!!errors.email}
                            {...registerField("email")}
                        />
                        {errors.email ? (
                            <p className="text-xs text-destructive">{errors.email.message}</p>
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
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 48 48"
                                            className="size-6"
                                        >
                                            <title>Google</title>
                                            <path
                                                fill="#EA4335"
                                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"
                                            />
                                            <path
                                                fill="#4285F4"
                                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                            />
                                            <path
                                                fill="#FBBC05"
                                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                            />
                                            <path
                                                fill="#34A853"
                                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                            />
                                            <path fill="none" d="M0 0h48v48H0z" />
                                        </svg>
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
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            className="size-6"
                                            fill="currentColor"
                                        >
                                            <title>GitHub</title>
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
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
