import { useLoginFlows } from "@features/auth/hooks/use-login-flows";
import { GithubIcon, GoogleIcon, Input } from "@violet/ui";
import { cn } from "cn";
import { ChevronDown, Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GoogleOAuthGate } from "./GoogleOAuthGate";

export interface InlineLoginProps {
	/** 任一方式登录成功后调用 */
	onSuccess: () => void;
	/** 说明文案，显示在登录方式上方 */
	description?: string;
	className?: string;
}

const PROVIDER_BUTTON =
	"inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-background py-2 text-sm font-medium text-foreground shadow-[0_4px_24px_rgb(0_0_0/0.05)] transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";

/**
 * 在批注面板或评论区内登录，不弹窗、不离开当前页。
 *
 * @remarks 随登录区域挂载准备 SDK；成功后调用方继续发送批注或刷新评论。
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

	return (
		<div className={cn("rounded-2xl bg-primary/6 p-4", className)}>
			{description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}

			{showOAuth && (
				<div className="flex gap-2">
					{showGithub && (
						<button
							type="button"
							onClick={startGithub}
							disabled={githubPending}
							className={PROVIDER_BUTTON}
						>
							{githubPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<GithubIcon className="size-4" />
							)}
							GitHub
						</button>
					)}
					{showGoogle && (
						<button
							type="button"
							onClick={startGoogle}
							disabled={googlePending || !googleReady}
							className={PROVIDER_BUTTON}
						>
							{googlePending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<GoogleIcon className="size-4" />
							)}
							Google
						</button>
					)}
				</div>
			)}
			{showGoogle && googleError}

			{showOAuth && (
				<button
					type="button"
					onClick={() => setPasswordOpen((v) => !v)}
					aria-expanded={passwordOpen}
					className="mt-3 inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					使用账号密码登录
					<ChevronDown
						className={cn(
							"size-3.5 transition-transform duration-300",
							passwordOpen && "rotate-180",
						)}
					/>
				</button>
			)}

			{/* -m-1 p-1：折叠需要 overflow-hidden，给聚焦环留 4px 外扩空间 */}
			<div
				className={cn(
					"grid transition-[grid-template-rows,opacity] duration-300 ease-out",
					passwordOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
				)}
			>
				<div className="-m-1 overflow-hidden p-1">
					<form
						className="space-y-2 pt-3"
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
							tabIndex={passwordOpen ? 0 : -1}
						/>
						<Input
							type="password"
							aria-label="密码"
							placeholder="密码（至少 8 位）"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="current-password"
							tabIndex={passwordOpen ? 0 : -1}
						/>
						<button
							type="submit"
							disabled={!valid || passwordPending || !csrfToken}
							tabIndex={passwordOpen ? 0 : -1}
							className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{passwordPending && <Loader2 className="size-4 animate-spin" />}
							{passwordPending ? "登录中…" : "登录"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
