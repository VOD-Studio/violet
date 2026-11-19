import { useForgotPassword, useResetPassword } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { parseAuthEntrySearch } from "@features/auth/lib/auth-entry-search";
import {
	type ForgotPasswordFormData,
	forgotPasswordSchema,
	type ResetPasswordFormData,
	resetPasswordSchema,
} from "@features/auth/model/schemas";
import { AuthPageLayout } from "@features/auth/ui/AuthPageLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Field, Input, InputOTP, ResendButton } from "@violet/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/error";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	validateSearch: parseAuthEntrySearch,
	head: () => ({ meta: [{ title: "找回密码" }] }),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	const { redirect, email } = useSearch({ from: "/forgot-password" });
	const csrfToken = useCsrfToken();
	const [sentEmail, setSentEmail] = useState<string | null>(null);
	const [invalidCode, setInvalidCode] = useState(false);
	const [submitError, setSubmitError] = useState("");

	// 步骤 1 表单：邮箱
	const {
		register: registerEmail,
		handleSubmit: handleSubmitEmail,
		formState: { errors: emailErrors },
	} = useForm<ForgotPasswordFormData>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: { email: email ?? "" },
	});

	// 步骤 2 表单：验证码 + 新密码 + 确认
	const {
		register: registerReset,
		handleSubmit: handleSubmitReset,
		setValue: setResetValue,
		watch: watchReset,
		reset: resetForm,
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
		setSubmitError("");
		forgotMutation.mutate(
			{ email: data.email },
			{
				onSuccess: () => {
					setSentEmail(data.email);
					setResetValue("email", data.email);
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message
							: err.message || "发送失败，请稍后重试";
					setSubmitError(msg);
				},
			},
		);
	});

	// 步骤 2：重置密码
	const onSubmitReset = handleSubmitReset((data) => {
		setSubmitError("");
		resetMutation.mutate(
			{ email: data.email, code: data.code, new_password: data.newPassword },
			{
				onSuccess: () => {
					toast.success("密码已重置，请登录");
					navigate({
						to: "/login",
						replace: true,
						search: { email: data.email, ...(redirect ? { redirect } : {}) },
					});
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message || "重置失败，请检查验证码"
							: err.message || "重置失败";
					if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
						setResetError("code", { type: "server", message: msg });
						setInvalidCode(true);
					} else {
						setSubmitError(msg);
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
		setSubmitError("");
		try {
			await forgotMutation.mutateAsync({ email });
			setResetValue("code", "");
			clearResetErrors("code");
			setInvalidCode(false);
			toast.success("如果邮箱已注册，你会收到新的重置邮件");
			return true;
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : "重发失败";
			setSubmitError(msg);
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
		<AuthPageLayout
			title={sentEmail ? "重置密码" : "找回密码"}
			description={
				sentEmail ? (
					<>
						如果{" "}
						<span className="break-all font-medium text-foreground">{sentEmail}</span>{" "}
						已注册，你会收到一封重置邮件。
					</>
				) : (
					"填写注册邮箱，我们会发送六位验证码。"
				)
			}
		>
			{sentEmail ? (
				<form onSubmit={onSubmitReset} className="space-y-4">
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
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<ResendButton
							onResend={handleResend}
							resetKey={sentEmail}
							disabled={resetMutation.isPending || !csrfToken}
						/>
						<Button
							variant="ghost"
							disabled={resetMutation.isPending || forgotMutation.isPending}
							onClick={() => {
								setSentEmail(null);
								setInvalidCode(false);
								setSubmitError("");
								resetForm();
							}}
						>
							更改邮箱
						</Button>
					</div>
					<Field label="新密码" error={resetErrors.newPassword?.message}>
						<Input
							type="password"
							passwordToggle
							autoComplete="new-password"
							{...registerReset("newPassword")}
						/>
					</Field>
					<Field label="确认新密码" error={resetErrors.confirmPassword?.message}>
						<Input
							type="password"
							passwordToggle
							autoComplete="new-password"
							{...registerReset("confirmPassword")}
						/>
					</Field>
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
						disabled={resetMutation.isPending || forgotMutation.isPending || !csrfToken}
					>
						{resetMutation.isPending ? "正在重置…" : "重置密码"}
					</Button>
				</form>
			) : (
				<form onSubmit={onSubmitEmail} className="space-y-4">
					<Field label="注册邮箱" error={emailErrors.email?.message}>
						<Input type="email" autoComplete="email" {...registerEmail("email")} />
					</Field>
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
						disabled={forgotMutation.isPending || !csrfToken}
					>
						{forgotMutation.isPending ? "正在发送…" : "发送重置码"}
					</Button>
				</form>
			)}
			<p className="text-center text-sm text-muted-foreground">
				<Link
					to="/login"
					search={{ redirect, email: sentEmail ?? email }}
					className="font-semibold text-primary hover:underline"
				>
					返回登录
				</Link>
			</p>
		</AuthPageLayout>
	);
}
