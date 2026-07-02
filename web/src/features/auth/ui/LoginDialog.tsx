import { authKeys } from "@features/auth/api/keys";
import { useGoogleLoginMutation, useLogin } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useLoginDialogStore } from "@features/auth/model/login-dialog-store";
import type { LoginRequest } from "@features/auth/model/types";
import { useGoogleLogin } from "@react-oauth/google";
import { flush, rejectAll, setOpener } from "@shared/api/auth-gate";
import { ApiError } from "@shared/api/error";
import { clearSessionActive } from "@shared/api/session";
import { Button } from "@shared/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";

/**
 * 后端未返回 message 时的兜底文案（按状态码）。与 /login 页面保持一致。
 */
const FALLBACK_BY_STATUS: Record<number, string> = {
    401: "邮箱或密码错误",
    403: "账户不可用，请联系管理员",
    429: "请求过于频繁，请稍后再试",
};

/**
 * LoginDialog - 全局登录弹窗
 *
 * 两路触发：
 * 1. 主动：Header「登录」按钮调 store.open
 * 2. 被动：http 拦截器 refresh 失败 → authGate.requestReplay 挂起请求 →
 *    经此处注册的 opener 自动弹窗，用户重登成功后 flush() 重放原请求。
 *
 * 取消（点关闭/遮罩/ESC）时：rejectAll() 拒绝所有挂起请求，并把 me 缓存
 * 置 undefined（反映 token 已失效），若当前在受保护页则跳 /login 兜底。
 */
export function LoginDialog() {
    const isOpen = useLoginDialogStore((s) => s.isOpen);
    const open = useLoginDialogStore((s) => s.open);
    const close = useLoginDialogStore((s) => s.close);
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    // qc 在 AppProvider 树内解析（LoginDialog 挂在 __root 的 AppProvider 子树）
    const qc = useQueryClient();
    const csrfToken = useCsrfToken({ enabled: isOpen });
    const login = useLogin();
    const googleLogin = useGoogleLoginMutation(csrfToken);

    const handleGoogleLogin = useGoogleLogin({
        flow: "implicit",
        onSuccess: (tokenResponse) => {
            googleLogin.mutate(tokenResponse.access_token, {
                onSuccess: async () => {
                    closingForSuccess.current = true;
                    toast.success("登录成功");
                    close();
                    setForm({ email: "", password: "" });
                    try {
                        await flush();
                    } catch {}
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
        window.location.href =
            "https://github.com/login/oauth/authorize?client_id=" +
            import.meta.env.VITE_GITHUB_CLIENT_ID +
            "&scope=user:email";
    };

    const [form, setForm] = useState<LoginRequest>({ email: "", password: "" });
    const [errors, setErrors] = useState<Partial<Record<keyof LoginRequest, string>>>({});
    // 区分「程序化关闭」（登录成功后调 close()）与「用户取消」（点关闭/遮罩/ESC）。
    // 两者都会让 isOpen 翻 false → 触发 onOpenChange(false)，但只有用户取消才该
    // 拒绝挂起请求 + 清会话。登录成功时置 true，让 handleOpenChange 跳过取消逻辑。
    const closingForSuccess = useRef(false);

    // 注册 opener：authGate 挂起请求时通过它开门。组件卸载时解绑。
    // open 来自 store，引用稳定；以闭包包装避免把 store action 直接交给底层。
    useEffect(() => {
        setOpener(() => open());
        return () => setOpener(null);
    }, [open]);

    const validate = (): boolean => {
        const next: typeof errors = {};
        if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
            next.email = "请输入有效的邮箱地址";
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
            onSuccess: async () => {
                toast.success("登录成功");
                // 标记本次关闭是登录成功，而非用户取消。
                // close() 会让 isOpen 翻 false → Radix 触发 onOpenChange(false)，
                // 不打标记的话会被当成取消：rejectAll + 清会话 + 跳 /login，登录白做。
                closingForSuccess.current = true;
                // 关闭弹窗并清空敏感字段，避免下次打开残留密码
                close();
                setForm({ email: "", password: "" });
                // 用新 cookie 重放所有挂起请求（鉴权降级场景）。
                try {
                    await flush();
                } catch {
                    // 单个重放失败已各自 reject，整体不阻塞登录成功
                }
            },
            onError: (err) => {
                const msg =
                    err instanceof ApiError
                        ? err.message || FALLBACK_BY_STATUS[err.status] || "登录失败，请稍后再试"
                        : err.message || "登录失败，请检查邮箱和密码";
                toast.error(msg);
            },
        });
    };

    /**
     * onOpenChange - 处理关闭（点关闭按钮/遮罩/ESC）
     *
     * 仅「用户取消」走这里：拒绝挂起请求、清会话标志、回首页。
     * 登录成功的 close() 也会触发本回调（isOpen false），但 onSuccess 已先置
     * closingForSuccess=true，这里据此跳过取消逻辑，避免把刚登录的会话清掉。
     */
    const handleOpenChange = (next: boolean) => {
        if (next) {
            open();
            return;
        }
        // 登录成功导致的关闭：放行，不做取消处理
        if (closingForSuccess.current) {
            closingForSuccess.current = false;
            return;
        }
        // 用户主动放弃重登：拒绝挂起请求、清会话状态、回首页。
        rejectAll();
        // removeQueries 真正清除 me 缓存（v5 中 setQueryData(undefined) 是 no-op），
        // 让 Header 等订阅者立即翻回未登录态。
        qc.removeQueries({ queryKey: authKeys.me() });
        // 清除会话活跃标志：用户明确放弃重登 = 主动登出语义，
        // 守卫此后可正常踢人；下次访问受保护页会重新走未登录流程。
        clearSessionActive();
        close();
        setForm((f) => ({ ...f, password: "" }));

        // 在受保护页（profile/admin）取消重登 → 回首页（公开页无需跳）
        const needsAuth = pathname.startsWith("/profile") || pathname.startsWith("/admin");
        if (needsAuth) {
            navigate({ to: "/", replace: true }).catch(() => {
                // 导航失败不影响已清空的登录态
            });
        }
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={handleOpenChange}
            title="重新登录"
            description="登录状态已失效，请重新登录后继续。成功后将自动恢复你正在进行的操作。"
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
                    <Label htmlFor="login-dialog-email">邮箱</Label>
                    <Input
                        id="login-dialog-email"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        aria-invalid={!!errors.email}
                        autoComplete="email"
                    />
                    {errors.email ? (
                        <p className="text-sm text-destructive">{errors.email}</p>
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

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">或者</span>
                    </div>
                </div>

                <div className="flex justify-center">
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
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default LoginDialog;
