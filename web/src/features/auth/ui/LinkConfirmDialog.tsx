import { useConfirmLinkMutation } from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useLinkConfirmStore } from "@features/auth/model/link-confirm-store";
import { ApiError } from "@shared/api/error";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, Input, Label, Modal } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * LinkConfirmDialog - OAuth 首次匹配的密码确认绑定弹窗
 *
 * OAuth 登录 email 匹配到已有账号且未绑定该 provider 时（409），输入该账号
 * 密码确认后绑定并登录。无密码账号（OAuth 建号）引导走忘记密码补设后回来。
 * 全局挂载于 __root，由 useLinkConfirmStore 触发。
 */

/** 读当前路由 search 的 redirect 参数（登录页跳转目标），非字符串或缺省返回 undefined */
function readRedirect(search: unknown): string | undefined {
	if (typeof search !== "object" || search === null || !("redirect" in search)) {
		return undefined;
	}
	return typeof search.redirect === "string" ? search.redirect : undefined;
}
export function LinkConfirmDialog() {
	const payload = useLinkConfirmStore((s) => s.payload);
	const closeConfirm = useLinkConfirmStore((s) => s.close);
	const closeLogin = useLoginDialogStore((s) => s.close);
	const csrfToken = useCsrfToken({ enabled: payload !== null });
	const confirmLink = useConfirmLinkMutation(csrfToken);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const redirect = readRedirect(useRouterState({ select: (s) => s.location.search }));

	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const open = payload !== null;

	const reset = () => {
		setPassword("");
		setError("");
	};

	const handleClose = () => {
		reset();
		closeConfirm();
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!password) {
			setError("请输入密码");
			return;
		}
		confirmLink.mutate(
			{ linkToken: payload?.linkToken ?? "", password },
			{
				onSuccess: () => {
					toast.success("绑定成功，已登录");
					reset();
					closeConfirm();
					// 若从登录弹窗发起，一并收起（GitHub 回调页无登录弹窗，close 幂等）
					closeLogin();
					// /login 页发起时 beforeLoad 不会重跑，已登录用户会滞留登录页，需显式跳转
					if (pathname === "/login") {
						const target = redirect || "/";
						navigate({ to: target, replace: true }).catch(() => {
							window.location.href = target;
						});
					}
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError
							? err.message || "确认失败，请重试"
							: "确认失败，请检查网络";
					// 密码错误可重试（token 未消费），过期则关闭弹窗提示重来
					if (err instanceof ApiError && err.status === 400) {
						toast.error("绑定确认已过期，请重新发起登录");
						handleClose();
						return;
					}
					setError(msg);
				},
			},
		);
	};

	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				if (!next) handleClose();
			}}
			title="该邮箱已注册账号"
			description={
				payload
					? `输入账号密码确认绑定 ${payload.provider}，绑定后可使用 ${payload.provider} 直接登录`
					: ""
			}
			size="sm"
			footer={
				payload?.hasPassword ? (
					<>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={confirmLink.isPending}
						>
							取消
						</Button>
						<Button
							type="submit"
							form="link-confirm-form"
							disabled={confirmLink.isPending}
						>
							{confirmLink.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							确认绑定
						</Button>
					</>
				) : undefined
			}
		>
			{payload?.hasPassword ? (
				<form id="link-confirm-form" onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="link-confirm-email">账号邮箱</Label>
						<Input id="link-confirm-email" value={payload.email} disabled />
					</div>
					<div className="space-y-2">
						<Label htmlFor="link-confirm-password">密码</Label>
						<Input
							id="link-confirm-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							aria-invalid={!!error}
							autoComplete="current-password"
							placeholder="••••••••"
						/>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</div>
				</form>
			) : (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						账号 {payload?.email} 未设置密码，无法在此确认绑定。
					</p>
					<Button
						variant="outline"
						className="w-full"
						onClick={() => {
							handleClose();
							window.location.href = "/forgot-password";
						}}
					>
						通过「忘记密码」设置密码后回来绑定
					</Button>
				</div>
			)}
		</Modal>
	);
}

export default LinkConfirmDialog;
