import { authKeys } from "@features/auth/api/keys";
import { useLogin } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { type LoginFormData, loginSchema } from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
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
                        disabled={login.isPending || !csrfToken}
                    >
                        {login.isPending ? "登录中…" : "登录"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
