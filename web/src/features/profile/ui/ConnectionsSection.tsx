import type { UserDTO } from "@entities/user/model/types";
import {
	useBindConnectionMutation,
	useUnbindConnectionMutation,
} from "@features/auth/api/mutations";
import { useCsrfToken } from "@features/auth/api/queries";
import { useOAuthVisibility } from "@features/auth/hooks/use-oauth-visibility";
import { useGoogleLogin } from "@react-oauth/google";
import { GithubIcon } from "@violet/ui";
import { CheckCircle2, KeyRound, Link2, Link2Off, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "./SectionCard";

interface ConnectionsSectionProps {
	user: UserDTO;
}

/** GitHub 绑定意图标记：回调页据此区分「绑定」与「登录」。 */
export const GITHUB_BIND_INTENT_KEY = "violet:github-bind-intent";

/**
 * ConnectionsSection - 登录方式卡片
 *
 * 展示并管理登录途径（密码 / Google / GitHub）：未绑定的 provider 提供绑定
 * 入口（OAuth 流后 POST /auth/connections），已绑定的提供解绑（带确认，
 * 后端校验解绑后至少保留一种登录方式）。
 */
export const ConnectionsSection = ({ user }: ConnectionsSectionProps) => {
	const csrfToken = useCsrfToken();
	const bindConnection = useBindConnectionMutation(csrfToken);
	const unbindConnection = useUnbindConnectionMutation(csrfToken);
	const { showGoogle, showGithub, githubClientId } = useOAuthVisibility();
	const [pendingProvider, setPendingProvider] = useState<"google" | "github" | null>(null);

	const handleBindError = (err: unknown, provider: string) => {
		const msg = err instanceof Error ? err.message : "绑定失败，请重试";
		toast.error(`${provider} 绑定失败：${msg}`);
	};

	const googleLogin = useGoogleLogin({
		flow: "implicit",
		onSuccess: (tokenResponse) => {
			setPendingProvider("google");
			bindConnection.mutate(
				{ provider: "google", credential: tokenResponse.access_token },
				{
					onSuccess: () => toast.success("Google 绑定成功"),
					onError: (err) => handleBindError(err, "Google"),
					onSettled: () => setPendingProvider(null),
				},
			);
		},
		onError: () => toast.error("Google 授权失败，请重试"),
	});

	const startGithubBind = () => {
		const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
		const clientId = githubClientId || import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			toast.error("GitHub 登录未配置");
			return;
		}
		// 回调页共用登录的 redirect_uri，以 sessionStorage 标记绑定意图
		window.sessionStorage.setItem(GITHUB_BIND_INTENT_KEY, "1");
		window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;
	};

	const handleUnbind = (provider: "google" | "github") => {
		const label = provider === "google" ? "Google" : "GitHub";
		if (!window.confirm(`解绑${label}后将无法使用${label}登录，确定解绑？`)) return;
		setPendingProvider(provider);
		unbindConnection.mutate(provider, {
			onSuccess: () => toast.success(`${label} 已解绑`),
			onError: (err) => {
				const msg = err instanceof Error ? err.message : "解绑失败";
				toast.error(msg);
			},
			onSettled: () => setPendingProvider(null),
		});
	};

	const pending = (provider: "google" | "github") =>
		pendingProvider === provider || bindConnection.isPending || unbindConnection.isPending;

	return (
		<SectionCard title="登录方式" description="当前可用的登录途径">
			<dl className="divide-y">
				<Row
					icon={<KeyRound className="size-4" />}
					label="邮箱密码"
					bound={user.has_password}
					boundText="已设置"
					unboundText="未设置"
				/>
				{showGoogle ? (
					<Row
						icon={<Mail className="size-4" />}
						label="Google"
						bound={user.google_bound}
						boundText="已绑定"
						unboundText="未绑定"
						action={
							user.google_bound ? (
								<UnbindButton
									onClick={() => handleUnbind("google")}
									disabled={pending("google")}
								/>
							) : (
								<BindButton
									onClick={() => googleLogin()}
									disabled={pending("google")}
								/>
							)
						}
					/>
				) : null}
				{showGithub ? (
					<Row
						icon={<GithubIcon className="size-4" />}
						label="GitHub"
						bound={user.github_bound}
						boundText="已绑定"
						unboundText="未绑定"
						action={
							user.github_bound ? (
								<UnbindButton
									onClick={() => handleUnbind("github")}
									disabled={pending("github")}
								/>
							) : (
								<BindButton
									onClick={startGithubBind}
									disabled={pending("github")}
								/>
							)
						}
					/>
				) : null}
			</dl>
		</SectionCard>
	);
};

const BindButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
	>
		{disabled ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
		绑定
	</button>
);

const UnbindButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
	>
		{disabled ? (
			<Loader2 className="size-3.5 animate-spin" />
		) : (
			<Link2Off className="size-3.5" />
		)}
		解绑
	</button>
);

const Row = ({
	icon,
	label,
	bound,
	boundText,
	unboundText,
	action,
}: {
	icon: React.ReactNode;
	label: string;
	bound: boolean;
	boundText: string;
	unboundText: string;
	action?: React.ReactNode;
}) => {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<dt className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
				{icon}
				{label}
			</dt>
			<dd className="flex items-center gap-3 text-sm">
				{bound ? (
					<>
						<CheckCircle2 className="size-3.5 text-success" />
						<span>{boundText}</span>
					</>
				) : (
					<>
						<Link2Off className="size-3.5 text-muted-foreground/60" />
						<span className="text-muted-foreground">{unboundText}</span>
					</>
				)}
				{action}
			</dd>
		</div>
	);
};
