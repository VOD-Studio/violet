import { useRegister, useVerifyEmail } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { parseAuthEntrySearch } from "@features/auth/lib/auth-entry-search";
import { type RegisterFormData, registerSchema } from "@features/auth/model/schemas";
import { AuthPageLayout } from "@features/auth/ui/AuthPageLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@shared/api/error";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Field, Input, InputOTP, ResendButton } from "@violet/ui";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
	ssr: false,
	validateSearch: parseAuthEntrySearch,
	head: () => ({ meta: [{ title: "注册" }] }),
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const { redirect, email } = useSearch({ from: "/register" });
	const csrfToken = useCsrfToken();
	const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
	const [registrationToken, setRegistrationToken] = useState<string>();
	const [code, setCode] = useState("");
	const [verificationError, setVerificationError] = useState("");
	const [submitError, setSubmitError] = useState("");
	const [invalidCode, setInvalidCode] = useState(false);
	const verifying = useRef(false);

	const {
		register: registerField,
		handleSubmit,
		getValues,
		formState: { errors },
	} = useForm<RegisterFormData>({
		resolver: zodResolver(registerSchema),
		defaultValues: { email: email ?? "", username: "", password: "", confirmPassword: "" },
	});

	const registerMutation = useRegister();
	const verifyMutation = useVerifyEmail();

	// 步骤 1：提交注册
	const onSubmitRegister = handleSubmit((data) => {
		setSubmitError("");
		registerMutation.mutate(
			{
				email: data.email,
				username: data.username,
				password: data.password,
				registration_token: registrationToken,
			},
			{
				onSuccess: ({ registration_token }) => {
					if (registration_token) setRegistrationToken(registration_token);
					setRegisteredEmail(data.email);
					setCode("");
					setVerificationError("");
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message || "注册失败，请稍后重试"
							: err.message || "注册失败";
					setSubmitError(msg);
				},
			},
		);
	});

	const submitVerify = (codeValue: string) => {
		if (!registeredEmail || codeValue.length !== 6 || verifying.current) return;
		verifying.current = true;
		setVerificationError("");
		setInvalidCode(false);
		verifyMutation.mutate(
			{ email: registeredEmail, code: codeValue },
			{
				onSuccess: () => {
					toast.success("邮箱验证成功，请登录");
					navigate({
						to: "/login",
						replace: true,
						search: { email: registeredEmail, ...(redirect ? { redirect } : {}) },
					});
				},
				onError: (err) => {
					const message = err.message || "验证失败，请稍后重试";
					setVerificationError(message);
					// 此端点仅在验证码不匹配时返回 UNAUTHORIZED，网络与服务异常保留已填验证码。
					setInvalidCode(err instanceof ApiError && err.code === "UNAUTHORIZED");
				},
				onSettled: () => {
					verifying.current = false;
				},
			},
		);
	};

	const handleCodeChange = (value: string) => {
		setCode(value);
		setInvalidCode(false);
		if (value) setVerificationError("");
	};

	// 重发验证码（重新调 register，后端会覆盖旧码）。
	// 返回 false 表示未生效（ResendButton 不进入冷却），让用户能立即修正后重试。
	const handleResend = async (): Promise<boolean> => {
		const values = getValues();
		if (!registeredEmail) return false;
		setSubmitError("");
		try {
			const { registration_token } = await registerMutation.mutateAsync({
				email: registeredEmail,
				username: values.username,
				password: values.password,
				registration_token: registrationToken,
			});
			if (registration_token) setRegistrationToken(registration_token);
			setCode("");
			setInvalidCode(false);
			setVerificationError("");
			toast.success("验证码已重新发送");
			return true;
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : "重发失败";
			setSubmitError(msg);
			return false;
		}
	};

	return (
		<AuthPageLayout
			title={registeredEmail ? "检查收件箱" : "注册"}
			description={
				registeredEmail ? (
					<>
						请输入发往{" "}
						<span className="break-all font-medium text-foreground">
							{registeredEmail}
						</span>{" "}
						的六位号码。
					</>
				) : (
					"填写邮箱、用户名和密码，再验证邮箱。"
				)
			}
		>
			{registeredEmail ? (
				<div className="space-y-5">
					<Field
						label="邮箱验证码"
						error={verificationError}
						checking={verifyMutation.isPending ? "正在验证…" : undefined}
					>
						<InputOTP
							name="code"
							value={code}
							onChange={handleCodeChange}
							onComplete={submitVerify}
							invalid={invalidCode && !verifyMutation.isPending}
							valid={verifyMutation.isSuccess}
							required
							disabled={verifyMutation.isPending || registerMutation.isPending}
						/>
					</Field>
					{verificationError && !invalidCode && code.length === 6 ? (
						<Button
							onClick={() => submitVerify(code)}
							disabled={verifyMutation.isPending}
						>
							重新验证
						</Button>
					) : null}
					{submitError ? (
						<p role="alert" className="text-sm text-destructive">
							{submitError}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<ResendButton
							onResend={handleResend}
							resetKey={registeredEmail}
							disabled={verifyMutation.isPending || !csrfToken}
						/>
						{registrationToken ? (
							<Button
								variant="ghost"
								disabled={verifyMutation.isPending || registerMutation.isPending}
								onClick={() => {
									setRegisteredEmail(null);
									setCode("");
									setVerificationError("");
									setInvalidCode(false);
									setSubmitError("");
								}}
							>
								更改邮箱
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<form onSubmit={onSubmitRegister} className="space-y-2">
					<Field label="邮箱" error={errors.email?.message}>
						<Input type="email" autoComplete="email" {...registerField("email")} />
					</Field>
					<Field label="用户名" error={errors.username?.message}>
						<Input autoComplete="username" {...registerField("username")} />
					</Field>
					<Field label="密码" error={errors.password?.message}>
						<Input
							type="password"
							passwordToggle
							autoComplete="new-password"
							{...registerField("password")}
						/>
					</Field>
					<Field label="确认密码" error={errors.confirmPassword?.message}>
						<Input
							type="password"
							passwordToggle
							autoComplete="new-password"
							{...registerField("confirmPassword")}
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
						disabled={registerMutation.isPending || !csrfToken}
					>
						{registerMutation.isPending ? "正在发送验证码…" : "注册"}
					</Button>
				</form>
			)}
			<p className="text-center text-sm text-muted-foreground">
				已有账号？{" "}
				<Link
					to="/login"
					search={{ redirect, email: registeredEmail ?? email }}
					className="font-semibold text-primary hover:underline"
				>
					去登录
				</Link>
			</p>
		</AuthPageLayout>
	);
}
