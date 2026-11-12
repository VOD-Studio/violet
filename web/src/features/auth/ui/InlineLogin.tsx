import { useLoginFlows } from "@features/auth/hooks/use-login-flows";
import { Collapse } from "@shared/ui/disclosure";
import { Button, GithubIcon, GoogleIcon, Input, iconProps } from "@violet/ui";
import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GoogleOAuthGate } from "./GoogleOAuthGate";

export interface InlineLoginProps {
	/** 任一方式登录成功后调用 */
	onSuccess: () => void;
	/** 说明文案，显示在登录方式上方 */
	description?: string;
	className?: string;
}

/**
 * 在批注面板或评论区内登录，不弹窗、不离开当前页。
 *
 * @remarks 第三方登录在前、占主位，账号密码收在下方的分隔行里；没有配置第三方登录时直接展开账号密码。
 * 随登录区域挂载准备 SDK；成功后调用方继续发送批注或刷新评论。本组件不带底色与内边距，由调用方决定容器。
 */
export function InlineLogin(props: InlineLoginProps) {
	return (
		<GoogleOAuthGate>
			{(googleError) => <InlineLoginContent {...props} googleError={googleError} />}
		</GoogleOAuthGate>
	);
}

function InlineLoginContent({
	onSuccess,
	description,
	className,
	googleError,
}: InlineLoginProps & { googleError: ReactNode }) {
	const {
		csrfToken,
		startGoogle,
		startGithub,
		submitPassword,
		passwordPending,
		googlePending,
		googleReady,
		githubPending,
		showGoogle,
		showGithub,
		showOAuth,
	} = useLoginFlows({ onSuccess });
	const [passwordOpen, setPasswordOpen] = useState(!showOAuth);
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const valid = identifier.trim() !== "" && password.length >= 8;
	const providers = Number(showGithub) + Number(showGoogle);

	return (
		<div className={className}>
			{description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}

			{showOAuth && (
				<div className={cn("grid gap-2", providers > 1 && "grid-cols-2")}>
					{showGithub && (
						<Button
							type="button"
							variant="secondary"
							onClick={startGithub}
							disabled={githubPending}
							loading={githubPending}
							className="w-full"
							leftIcon={<GithubIcon className="size-4" />}
						>
							GitHub
						</Button>
					)}
					{showGoogle && (
						<Button
							type="button"
							variant="secondary"
							onClick={startGoogle}
							disabled={googlePending || !googleReady}
							loading={googlePending}
							className="w-full"
							leftIcon={<GoogleIcon className="size-4" />}
						>
							Google
						</Button>
					)}
				</div>
			)}
			{showGoogle && googleError}

			{showOAuth && (
				<button
					type="button"
					onClick={() => setPasswordOpen((v) => !v)}
					aria-expanded={passwordOpen}
					className="mt-3 flex w-full items-center gap-3 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<span className="h-px flex-1 bg-border" aria-hidden="true" />
					<span className="inline-flex items-center gap-1">
						使用账号密码登录
						<ChevronDown
							{...iconProps(
								14,
								cn(
									"transition-transform duration-200 motion-reduce:transition-none",
									passwordOpen && "rotate-180",
								),
							)}
						/>
					</span>
					<span className="h-px flex-1 bg-border" aria-hidden="true" />
				</button>
			)}

			<Collapse open={passwordOpen} keepMounted contentClassName="pt-3">
				<form
					className="space-y-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) submitPassword({ identifier: identifier.trim(), password });
					}}
				>
					<Input
						type="text"
						aria-label="用户名或邮箱"
						placeholder="用户名或邮箱"
						value={identifier}
						onChange={(e) => setIdentifier(e.target.value)}
						autoComplete="username"
					/>
					<Input
						type="password"
						aria-label="密码"
						placeholder="密码（至少 8 位）"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
					/>
					<Button
						type="submit"
						variant="primary"
						disabled={!valid || !csrfToken}
						loading={passwordPending}
						loadingText="登录中…"
						className="w-full"
					>
						登录
					</Button>
				</form>
			</Collapse>
		</div>
	);
}
