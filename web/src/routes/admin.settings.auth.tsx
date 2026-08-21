import {
	useAuthSettings,
	useOAuthStatus,
	useUpdateAuth,
	useUpdateOAuthCredentials,
} from "@features/admin-settings/api/queries";
import { OAuthProviderCard } from "@features/admin-settings/ui/OAuthProviderCard";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

/** 认证子页表单值（仅本页字段） */
interface AuthForm {
	google_login_enabled: boolean;
	github_login_enabled: boolean;
}

/**
 * 认证设置页：第三方登录开关与 OAuth 凭据同卡同存。
 *
 * 开关控制同卡凭据输入区的显隐（表单实时值，改即预览）；已配置且生效时
 * 输入区折叠，只留脱敏预览与「修改」入口。一个保存按钮先落开关
 * （site_settings 域），凭据输入了再落凭据（env 域，留空=保持原值），
 * 成功后递增 revision（作卡片 key）重置编辑态与检测结果。
 */
function AuthSettingsPage() {
	const { data: authData, isLoading } = useAuthSettings();
	const { data: oauthStatus } = useOAuthStatus();
	const updateAuth = useUpdateAuth();
	const updateCreds = useUpdateOAuthCredentials();

	const { control, handleSubmit, reset } = useForm<AuthForm>();
	useEffect(() => {
		if (authData) {
			reset({
				google_login_enabled: authData.google_login_enabled,
				github_login_enabled: authData.github_login_enabled,
			});
		}
	}, [authData, reset]);

	const [googleId, setGoogleId] = useState("");
	const [githubId, setGithubId] = useState("");
	const [githubSecret, setGithubSecret] = useState("");
	const [credRevision, setCredRevision] = useState(0);

	const onSubmit = handleSubmit(async (values) => {
		await updateAuth.mutateAsync(values);
		// 凭据留空=保持原值，只有填了才提交
		const body: Record<string, string> = {};
		if (values.google_login_enabled && googleId.trim()) {
			body.google_client_id = googleId.trim();
		}
		if (values.github_login_enabled) {
			if (githubId.trim()) body.github_client_id = githubId.trim();
			if (githubSecret.trim()) body.github_client_secret = githubSecret.trim();
		}
		if (Object.keys(body).length > 0) {
			await updateCreds.mutateAsync(body);
			setGoogleId("");
			setGithubId("");
			setGithubSecret("");
		}
		setCredRevision((r) => r + 1);
	});

	return (
		<SettingsSubPage
			title="认证"
			description="第三方登录开关与 OAuth 凭据"
			isLoading={isLoading}
			isPending={updateAuth.isPending || updateCreds.isPending}
			onSubmit={onSubmit}
		>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">第三方登录</h3>
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
								value: window.location.origin,
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
							docsUrl={`https://github.com/settings/applications/new?redirect_uri=${encodeURIComponent(`${window.location.origin}/auth/github/callback`)}`}
							callbackHint={{
								label: "Authorization callback URL",
								value: `${window.location.origin}/auth/github/callback`,
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
