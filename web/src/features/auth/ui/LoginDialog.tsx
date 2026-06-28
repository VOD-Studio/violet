import { authKeys } from "@features/auth/api/keys";
import { useLogin } from "@features/auth/api/mutations";
import { fetchCsrfToken } from "@features/auth/api/queries";
import { useLoginDialogStore } from "@features/auth/model/login-dialog-store";
import type { LoginRequest } from "@features/auth/model/types";
import { flush, rejectAll, setOpener } from "@shared/api/auth-gate";
import { ApiError } from "@shared/api/error";
import { clearSessionActive } from "@shared/api/session";
import { Button } from "@shared/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

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
    const login = useLogin();
    const [form, setForm] = useState<LoginRequest>({ email: "", password: "" });
    const [errors, setErrors] = useState<Partial<Record<keyof LoginRequest, string>>>({});
    const [csrfToken, setCsrfToken] = useState<string>("");
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

    // 弹窗打开时预取 CSRF token（双保险：cookie + 显式 header）
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        fetchCsrfToken()
            .then((res) => {
                if (cancelled) return;
                setCsrfToken(res.csrf_token);
            })
            .catch(() => {
                // 获取失败仍允许尝试登录，interceptor 会回退读 cookie
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

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
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-105">
                <DialogHeader>
                    <DialogTitle>重新登录</DialogTitle>
                    <DialogDescription>
                        登录状态已失效，请重新登录后继续。成功后将自动恢复你正在进行的操作。
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2">
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
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={login.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={login.isPending || !csrfToken}>
                            {login.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {login.isPending ? "登录中…" : "登录"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default LoginDialog;
