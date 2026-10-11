import { clearAuthCache } from "@features/auth/api/queries";
import { useLoginFlows } from "@features/auth/hooks/use-login-flows";
import type { LoginRequest } from "@features/auth/model/types";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { clearSessionActive } from "@shared/api/session";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, GithubIcon, GoogleIcon, Input, Label, Modal } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * 用户主动登录或已登录会话收到 401 时打开。
 *
 * 取消时清理认证缓存和会话状态；若当前在受保护页则回首页。
 */
export function LoginDialog() {
	const isOpen = useLoginDialogStore((s) => s.isOpen);
	const open = useLoginDialogStore((s) => s.open);
	const close = useLoginDialogStore((s) => s.close);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const qc = useQueryClient();
	const [form, setForm] = useState<LoginRequest>({ identifier: "", password: "" });
	const {
		csrfToken,
		startGoogle,
		startGithub,
		submitPassword,
		passwordPending,
		googlePending,
		githubPending,
		showGoogle,
		showGithub,
		showOAuth,
	} = useLoginFlows({
		enabled: isOpen,
		onSuccess: () => {
			close();
			setForm({ identifier: "", password: "" });
		},
	});
	const [errors, setErrors] = useState<Partial<Record<keyof LoginRequest, string>>>({});

	const validate = (): boolean => {
		const next: typeof errors = {};
		if (!form.identifier) {
			next.identifier = "请输入账号";
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

		submitPassword(form);
	};

	const handleOpenChange = async (next: boolean) => {
		if (next) {
			open();
			return;
		}
		// 用户取消/关闭弹窗：清会话状态（me + csrf + sessionActive），让守卫允许跳转登录页。
		// 复用 clearAuthCache（与 useLogout 同一逻辑），补上历史遗漏的 csrf-token 清理。
		clearAuthCache(qc);
		clearSessionActive();
		close();
		setForm((f) => ({ ...f, password: "" }));

		// 在受保护页（profile/admin）取消重登 → 回首页
		const needsAuth = pathname.startsWith("/profile") || pathname.startsWith("/admin");
		if (needsAuth) {
			navigate({ to: "/", replace: true }).catch(() => {});
		}
	};

	return (
		<Modal
			open={isOpen}
			onOpenChange={handleOpenChange}
			title="重新登录"
			description="登录状态已失效，请重新登录后继续。"
			size="sm"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={passwordPending || googlePending}
					>
						取消
					</Button>
					<Button
						type="submit"
						form="login-dialog-form"
						disabled={passwordPending || googlePending || !csrfToken}
					>
						{(passwordPending || googlePending) && (
							<Loader2 className="mr-2 size-4 animate-spin" />
						)}
						{passwordPending || googlePending ? "登录中…" : "登录"}
					</Button>
				</>
			}
		>
			<form id="login-dialog-form" onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="login-dialog-identifier">账号</Label>
					<Input
						id="login-dialog-identifier"
						type="text"
						placeholder="用户名或邮箱"
						value={form.identifier}
						onChange={(e) => setForm({ ...form, identifier: e.target.value })}
						aria-invalid={!!errors.identifier}
						autoComplete="username"
					/>
					{errors.identifier ? (
						<p className="text-sm text-destructive">{errors.identifier}</p>
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

				{showOAuth ? (
					<>
						<div className="relative">
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
									onClick={startGoogle}
									disabled={googlePending}
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
									onClick={startGithub}
									disabled={githubPending}
								>
									<GithubIcon title="GitHub" className="size-6" />
								</Button>
							) : null}
						</div>
					</>
				) : null}
			</form>
		</Modal>
	);
}

export default LoginDialog;
