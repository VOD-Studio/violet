import { useForgotPassword, useResetPassword } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import {
	type ForgotPasswordFormData,
	forgotPasswordSchema,
	type ResetPasswordFormData,
	resetPasswordSchema,
} from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, Input, InputOTP, Label, ResendButton } from "@violet/ui";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/error";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	const csrfToken = useCsrfToken();
	const [sentEmail, setSentEmail] = useState<string | null>(null);
	const [invalidCode, setInvalidCode] = useState(false);

	// 步骤 1 表单：邮箱
	const {
		register: registerEmail,
		handleSubmit: handleSubmitEmail,
		formState: { errors: emailErrors },
	} = useForm<ForgotPasswordFormData>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: { email: "" },
	});

	// 步骤 2 表单：验证码 + 新密码 + 确认
	const {
		register: registerReset,
		handleSubmit: handleSubmitReset,
		setValue: setResetValue,
		watch: watchReset,
		clearErrors: clearResetErrors,
		setError: setResetError,
		formState: { errors: resetErrors },
	} = useForm<ResetPasswordFormData>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: { email: "", code: "", newPassword: "", confirmPassword: "" },
	});

	const codeValue = watchReset("code");

	const forgotMutation = useForgotPassword();
	const resetMutation = useResetPassword();

	// 步骤 1：发送重置码
	const onSubmitEmail = handleSubmitEmail((data) => {
		forgotMutation.mutate(
			{ email: data.email },
			{
				onSuccess: () => {
					setSentEmail(data.email);
					setResetValue("email", data.email);
					toast.success("重置码已发送至该邮箱");
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message
							: err.message || "发送失败，请稍后重试";
					toast.error(msg);
				},
			},
		);
	});

	// 步骤 2：重置密码
	const onSubmitReset = handleSubmitReset((data) => {
		resetMutation.mutate(
			{ email: data.email, code: data.code, new_password: data.newPassword },
			{
				onSuccess: () => {
					toast.success("密码已重置，请登录");
					navigate({
						to: "/login",
						replace: true,
						search: { email: sentEmail ?? undefined },
					});
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message || "重置失败，请检查验证码"
							: err.message || "重置失败";
					toast.error(msg);
					if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
						setResetError("code", { type: "server", message: msg });
						setInvalidCode(true);
					}
				},
			},
		);
	});

	// 重发重置码。
	// 返回 false 表示未生效（ResendButton 不进入冷却），让用户能立即修正后重试。
	const handleResend = async (): Promise<boolean> => {
		const email = sentEmail;
		if (!email) return false;
		try {
			await forgotMutation.mutateAsync({ email });
			setResetValue("code", "");
			clearResetErrors("code");
			setInvalidCode(false);
			toast.success("重置码已重新发送");
			return true;
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : "重发失败";
			toast.error(msg);
			return false;
		}
	};

	// OTP 输入同步到 react-hook-form
	const handleCodeChange = (value: string) => {
		setResetValue("code", value, { shouldDirty: true });
		setInvalidCode(false);
		if (value) clearResetErrors("code");
	};

	return (
		<div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="font-mono text-2xl font-bold tracking-tight">找回密码</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{sentEmail ? "输入重置码和新密码" : "输入注册邮箱重置密码"}
					</p>
				</div>

				{sentEmail ? (
					// 步骤 2：重置码 + 新密码
					<form onSubmit={onSubmitReset} className="space-y-4">
						<div className="flex flex-col items-center gap-3 text-center">
							<MailCheck className="size-6 text-primary" />
							<p className="text-sm text-muted-foreground">
								重置码已发送至
								<br />
								<span className="font-medium text-foreground">{sentEmail}</span>
							</p>
						</div>

						<Field label="邮箱重置码" error={resetErrors.code?.message}>
							<InputOTP
								name="code"
								value={codeValue}
								onChange={handleCodeChange}
								invalid={invalidCode && !resetMutation.isPending}
								valid={resetMutation.isSuccess}
								required
								disabled={resetMutation.isPending || forgotMutation.isPending}
							/>
						</Field>

						<div className="text-center">
							<ResendButton
								onResend={handleResend}
								resetKey={sentEmail}
								disabled={resetMutation.isPending}
							/>
						</div>

						<div className="space-y-1">
							<Label htmlFor="newPassword">新密码</Label>
							<Input
								id="newPassword"
								type="password"
								placeholder="至少 8 位"
								aria-invalid={!!resetErrors.newPassword}
								{...registerReset("newPassword")}
							/>
							{resetErrors.newPassword ? (
								<p className="text-xs text-destructive">
									{resetErrors.newPassword.message}
								</p>
							) : null}
						</div>

						<div className="space-y-1">
							<Label htmlFor="confirmPassword">确认新密码</Label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder="再次输入新密码"
								aria-invalid={!!resetErrors.confirmPassword}
								{...registerReset("confirmPassword")}
							/>
							{resetErrors.confirmPassword ? (
								<p className="text-xs text-destructive">
									{resetErrors.confirmPassword.message}
								</p>
							) : null}
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={resetMutation.isPending || !csrfToken}
						>
							{resetMutation.isPending ? "重置中…" : "重置密码"}
						</Button>
					</form>
				) : (
					// 步骤 1：输入邮箱
					<form onSubmit={onSubmitEmail} className="space-y-4">
						<div className="space-y-1">
							<Label htmlFor="email">注册邮箱</Label>
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								aria-invalid={!!emailErrors.email}
								{...registerEmail("email")}
							/>
							{emailErrors.email ? (
								<p className="text-xs text-destructive">
									{emailErrors.email.message}
								</p>
							) : null}
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={forgotMutation.isPending || !csrfToken}
						>
							{forgotMutation.isPending ? "发送中…" : "发送重置码"}
						</Button>

						<p className="text-center text-xs text-muted-foreground">
							想起来了？
							<Link to="/login" className="ml-1 text-primary hover:underline">
								返回登录
							</Link>
						</p>
					</form>
				)}
			</div>
		</div>
	);
}
