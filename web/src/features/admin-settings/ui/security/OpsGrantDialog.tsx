import { useIssueOpsGrant, useRequestOpsGrantCode } from "@features/auth/api/sessions";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Modal } from "@shared/ui/modal";
import { type FormEvent, useState } from "react";

interface OpsGrantDialogProps {
	onOpenChange: (open: boolean) => void;
	/** 确认生效请求进行中（禁用提交防重复） */
	confirming: boolean;
	/** 二次验证通过后执行确认生效 */
	onGranted: () => Promise<void>;
}

/**
 * 短时运维授权确认对话框：当前密码或邮箱验证码二选一。
 * 授权绑定当前会话+类别（security），默认 10 分钟；OAuth 无密码用户走邮箱验证码。
 */
export function OpsGrantDialog({ onOpenChange, confirming, onGranted }: OpsGrantDialogProps) {
	const [method, setMethod] = useState<"password" | "email_code">("password");
	const [secret, setSecret] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const issueGrant = useIssueOpsGrant();
	const requestCode = useRequestOpsGrantCode();

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await issueGrant.mutateAsync({
			category: "security",
			method,
			password: method === "password" ? secret : undefined,
			code: method === "email_code" ? secret : undefined,
		});
		setSecret("");
		await onGranted();
	};

	return (
		<Modal
			open
			onOpenChange={onOpenChange}
			title="二次验证确认"
			description="高危安全变更需短时运维授权（10 分钟有效，绑定当前会话）。已设置密码用密码验证；OAuth 账号可发送验证码到绑定邮箱。"
			size="sm"
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button
						type="submit"
						form="ops-grant-form"
						disabled={confirming || issueGrant.isPending || !secret}
					>
						{issueGrant.isPending || confirming ? "验证中…" : "验证并确认生效"}
					</Button>
				</>
			}
		>
			<form id="ops-grant-form" onSubmit={submit} className="space-y-4">
				<div className="flex gap-2 text-sm">
					{(
						[
							["password", "当前密码"],
							["email_code", "邮箱验证码"],
						] as const
					).map(([option, label]) => (
						<Button
							key={option}
							type="button"
							variant={method === option ? "default" : "outline"}
							size="sm"
							className="flex-1"
							onClick={() => setMethod(option)}
						>
							{label}
						</Button>
					))}
				</div>
				{method === "email_code" && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={requestCode.isPending || codeSent}
						onClick={async () => {
							await requestCode.mutateAsync();
							setCodeSent(true);
						}}
					>
						{codeSent
							? "验证码已发送"
							: requestCode.isPending
								? "发送中…"
								: "发送验证码"}
					</Button>
				)}
				<Input
					type={method === "password" ? "password" : "text"}
					placeholder={method === "password" ? "当前密码" : "邮箱验证码"}
					value={secret}
					onChange={(e) => setSecret(e.target.value)}
					autoComplete={method === "password" ? "current-password" : "one-time-code"}
				/>
				{issueGrant.error && (
					<p role="alert" className="text-xs text-destructive">
						{issueGrant.error instanceof Error ? issueGrant.error.message : "验证失败"}
					</p>
				)}
			</form>
		</Modal>
	);
}
