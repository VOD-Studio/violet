import { useRegister, useVerifyEmail } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { type RegisterFormData, registerSchema } from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@shared/api/error";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shared/ui/otp";
import { ResendButton } from "@/shared/ui/resend-button";

/**
 * /register - 注册页（分步验证）
 *
 * 流程：
 * 1. 填写邮箱/用户名/密码 → POST /auth/register → 后端发 6 位验证码到邮箱
 *    （开发环境验证码会同步打到后端日志，方便联调）
 * 2. 注册成功后原地展开验证码输入区（不跳页面），输满 6 位自动提交
 *    POST /auth/verify-email → 验证成功跳 /login
 *
 * 重发验证码：重新调 register 接口（后端会覆盖旧码并重发）。
 */
export const Route = createFileRoute("/register")({
    ssr: false,
    component: RegisterPage,
});

function RegisterPage() {
    const navigate = useNavigate();
    const csrfToken = useCsrfToken();
    const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
    const [code, setCode] = useState("");

    const {
        register: registerField,
        handleSubmit,
        getValues,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { email: "", username: "", password: "", confirmPassword: "" },
    });

    const registerMutation = useRegister();
    const verifyMutation = useVerifyEmail();

    // 步骤 1：提交注册
    const onSubmitRegister = handleSubmit((data) => {
        registerMutation.mutate(
            { email: data.email, username: data.username, password: data.password },
            {
                onSuccess: () => {
                    setRegisteredEmail(data.email);
                    setCode("");
                    toast.success("注册成功，请输入邮箱收到的验证码");
                },
                onError: (err) => {
                    const msg =
                        err instanceof ApiError
                            ? err.message || "注册失败，请稍后重试"
                            : err.message || "注册失败";
                    toast.error(msg);
                },
            },
        );
    });

    // 步骤 2：验证码提交。必须用 useCallback 固定身份 + 在 onChange 里手动触发，
    // 不能放进 useEffect 的依赖——useVerifyEmail 返回的 mutation 对象每次渲染
    // 都是新引用，放进依赖会导致验证失败后 setCode("") → 重渲染 → mutation 新身份
    // → useEffect 重跑 → 再次提交 → 死循环（800+ 次请求）。
    //
    // 依赖刻意只放稳定值：registeredEmail（string）、navigate（router 稳定引用）。
    // verifyMutation 不放入——它是每次渲染的新引用，但 mutate 调用始终读取闭包内
    // 最新的（TanStack Query 保证内部状态最新），不会产生 stale closure。
    // biome-ignore lint/correctness/useExhaustiveDependencies: verifyMutation 引用不稳定，放入会导致死循环
    const submitVerify = useCallback(
        (codeValue: string) => {
            if (!registeredEmail || codeValue.length !== 6) return;
            verifyMutation.mutate(
                { email: registeredEmail, code: codeValue },
                {
                    onSuccess: () => {
                        toast.success("邮箱验证成功，请登录");
                        navigate({
                            to: "/login",
                            replace: true,
                            search: { email: registeredEmail },
                        });
                    },
                    onError: (err) => {
                        const msg =
                            err instanceof ApiError
                                ? err.message || "验证失败，请检查验证码"
                                : err.message || "验证失败";
                        toast.error(msg);
                        setCode("");
                    },
                },
            );
        },
        [registeredEmail, navigate],
    );

    // OTP 输入变化：更新 code，满 6 位时直接触发验证（不用 useEffect 自动提交）
    const handleCodeChange = (value: string) => {
        setCode(value);
        if (value.length === 6) {
            submitVerify(value);
        }
    };

    // 重发验证码（重新调 register，后端会覆盖旧码）
    const handleResend = () => {
        const values = getValues();
        if (!values.email) return;
        registerMutation.mutate(
            { email: values.email, username: values.username, password: values.password },
            {
                onSuccess: () => toast.success("验证码已重新发送"),
                onError: (err) => {
                    const msg = err instanceof ApiError ? err.message : err.message || "重发失败";
                    toast.error(msg);
                },
            },
        );
    };

    return (
        <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="font-mono text-2xl font-bold tracking-tight">注册</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {registeredEmail ? "验证您的邮箱地址" : "创建一个新账号"}
                    </p>
                </div>

                {registeredEmail ? (
                    // 步骤 2：验证码输入
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <MailCheck className="size-12 text-primary" />
                            <p className="text-sm text-muted-foreground">
                                验证码已发送至
                                <br />
                                <span className="font-medium text-foreground">
                                    {registeredEmail}
                                </span>
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <InputOTP
                                maxLength={6}
                                value={code}
                                onChange={handleCodeChange}
                                disabled={verifyMutation.isPending}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                            {verifyMutation.isPending ? (
                                <p className="text-xs text-muted-foreground">验证中…</p>
                            ) : null}
                        </div>

                        <div className="text-center">
                            <ResendButton
                                onResend={handleResend}
                                disabled={registerMutation.isPending}
                            />
                        </div>
                    </div>
                ) : (
                    // 步骤 1：注册表单
                    <form onSubmit={onSubmitRegister} className="space-y-4">
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
                            <Label htmlFor="username">用户名</Label>
                            <Input
                                id="username"
                                placeholder="3-32 个字符"
                                aria-invalid={!!errors.username}
                                {...registerField("username")}
                            />
                            {errors.username ? (
                                <p className="text-xs text-destructive">
                                    {errors.username.message}
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="至少 8 位"
                                aria-invalid={!!errors.password}
                                {...registerField("password")}
                            />
                            {errors.password ? (
                                <p className="text-xs text-destructive">
                                    {errors.password.message}
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="confirmPassword">确认密码</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="再次输入密码"
                                aria-invalid={!!errors.confirmPassword}
                                {...registerField("confirmPassword")}
                            />
                            {errors.confirmPassword ? (
                                <p className="text-xs text-destructive">
                                    {errors.confirmPassword.message}
                                </p>
                            ) : null}
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={registerMutation.isPending || !csrfToken}
                        >
                            {registerMutation.isPending ? "注册中…" : "注册"}
                        </Button>

                        <p className="text-center text-xs text-muted-foreground">
                            已有账号？
                            <Link to="/login" className="ml-1 text-primary hover:underline">
                                去登录
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
