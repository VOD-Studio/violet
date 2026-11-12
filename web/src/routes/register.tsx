import { useRegister, useVerifyEmail } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { type RegisterFormData, registerSchema } from "@features/auth/model/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@shared/api/error";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, Input, InputOTP, Label, ResendButton } from "@violet/ui";
import { MailCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
	ssr: false,
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const csrfToken = useCsrfToken();
	const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [verificationError, setVerificationError] = useState("");
	const [invalidCode, setInvalidCode] = useState(false);
	const verifying = useRef(false);

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
						search: { email: registeredEmail },
					});
				},
				onError: (err) => {
					const message = err.message || "验证失败，请稍后重试";
					setVerificationError(message);
					// 此端点仅在验证码不匹配时返回 UNAUTHORIZED，网络与服务异常保留已填验证码。
					setInvalidCode(err instanceof ApiError && err.code === "UNAUTHORIZED");
					toast.error(message);
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
		try {
			await registerMutation.mutateAsync({
				email: registeredEmail,
				username: values.username,
				password: values.password,
			});
			setCode("");
			setInvalidCode(false);
			setVerificationError("");
			toast.success("验证码已重新发送");
			return true;
		} catch (err) {
			const msg = err instanceof ApiError ? err.message : "重发失败";
			toast.error(msg);
			return false;
		}
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
							<MailCheck className="size-6 text-primary" />
							<p className="text-sm text-muted-foreground">
								验证码已发送至
								<br />
								<span className="font-medium text-foreground">
									{registeredEmail}
								</span>
							</p>
						</div>

						<Field
							label="邮箱验证码"
							error={verificationError}
							checking={verifyMutation.isPending ? "验证中…" : undefined}
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

						<div className="text-center">
							<ResendButton
								onResend={handleResend}
								resetKey={registeredEmail}
								disabled={verifyMutation.isPending}
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
