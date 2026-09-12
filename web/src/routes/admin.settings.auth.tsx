import {
	useAuthSettings,
	useOAuthStatus,
	useUpdateAuth,
	useUpdateOAuthCredentials,
} from "@features/admin-settings/api/queries";
import type { AuthSettingsDTO, OAuthCredentialsInput } from "@features/admin-settings/model/types";
import { OAuthProviderCard } from "@features/admin-settings/ui/OAuthProviderCard";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Controller } from "react-hook-form";

/** 认证子页表单值（仅本页字段） */
interface AuthForm {
	google_login_enabled: boolean;
	github_login_enabled: boolean;
}

/** 登录开关使用组版本；OAuth 凭据保持独立端点与保留空白语义。 */
function AuthSettingsPage() {
	const oauthQuery = useOAuthStatus();
	const oauthStatus = oauthQuery.data;
	const updateCreds = useUpdateOAuthCredentials();
	const [googleId, setGoogleId] = useState("");
	const [githubId, setGithubId] = useState("");
	const [githubSecret, setGithubSecret] = useState("");
	const [credRevision, setCredRevision] = useState(0);
	const clearCredentials = () => {
		setGoogleId("");
		setGithubId("");
		setGithubSecret("");
		setCredRevision((revision) => revision + 1);
	};
	const { control, page } = useSettingsForm<AuthForm, AuthSettingsDTO>(
		useAuthSettings(),
		useUpdateAuth(),
		(data) => ({ ...data }),
		{
			group: "auth",
			extraDirty: !!(googleId || githubId || githubSecret),
			extraPending: updateCreds.isPending,
			onDiscardExtra: clearCredentials,
			onSaveExtra: async () => {
				const body: OAuthCredentialsInput = {};
				if (googleId.trim()) body.google_client_id = googleId.trim();
				if (githubId.trim()) body.github_client_id = githubId.trim();
				if (githubSecret.trim()) body.github_client_secret = githubSecret.trim();
				if (Object.keys(body).length > 0) await updateCreds.mutateAsync(body);
				clearCredentials();
			},
		},
	);
	const origin = typeof window === "undefined" ? "" : window.location.origin;

	return (
		<SettingsSubPage title="认证" description="第三方登录开关与 OAuth 凭据" state={page}>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">第三方登录</h3>
				{oauthQuery.isError && (
					<div role="alert" className="flex flex-col items-start gap-2">
						<p className="text-sm text-destructive">
							OAuth 状态加载失败：{oauthQuery.error.message}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => oauthQuery.refetch()}
						>
							重试凭据状态
						</Button>
					</div>
				)}
				{oauthStatus && !oauthStatus.persisted && (
					<p className="text-xs text-amber-600">
						上次保存的 OAuth 凭据未能写入 .env，API 重启后将失效
					</p>
				)}
				<Controller
					control={control}
					name="google_login_enabled"
					render={({ field }) => (
						<OAuthProviderCard
							name="Google"
							provider="google"
							enabled={field.value ?? false}
							onEnabledChange={field.onChange}
							status={oauthStatus?.google}
							docsUrl="https://console.cloud.google.com/apis/credentials"
							callbackHint={{
								label: "Authorized JavaScript origins",
								value: origin,
							}}
							key={`google-${credRevision}`}
						>
							<Field label="Google Client ID">
								<Input
									placeholder="xxxxxxxx.apps.googleusercontent.com"
									value={googleId}
									onChange={(e) => setGoogleId(e.target.value)}
									autoComplete="off"
								/>
							</Field>
						</OAuthProviderCard>
					)}
				/>
				<Controller
					control={control}
					name="github_login_enabled"
					render={({ field }) => (
						<OAuthProviderCard
							name="GitHub"
							provider="github"
							enabled={field.value ?? false}
							onEnabledChange={field.onChange}
							status={oauthStatus?.github}
							docsUrl={`https://github.com/settings/applications/new?redirect_uri=${encodeURIComponent(`${origin}/auth/github/callback`)}`}
							callbackHint={{
								label: "Authorization callback URL",
								value: `${origin}/auth/github/callback`,
							}}
							key={`github-${credRevision}`}
						>
							<Field label="GitHub Client ID">
								<Input
									placeholder="Ov23…"
									value={githubId}
									onChange={(e) => setGithubId(e.target.value)}
									autoComplete="off"
								/>
							</Field>
							<Field label="GitHub Client Secret">
								<Input
									type="password"
									value={githubSecret}
									onChange={(e) => setGithubSecret(e.target.value)}
									autoComplete="new-password"
								/>
							</Field>
						</OAuthProviderCard>
					)}
				/>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/auth")({
	component: AuthSettingsPage,
});
