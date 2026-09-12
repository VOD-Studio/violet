import { useGithubSettings, useUpdateGithub } from "@features/admin-settings/api/queries";
import type { GithubSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";

/** GitHub 子页表单值（仅本页字段） */
interface GithubForm {
	github_username: string;
	github_token: string;
	releases_repo: string;
}

function GithubSettingsPage() {
	const { register, page, snapshot, clearSecret, cancelSecretClear, clearedSecrets } =
		useSettingsForm<GithubForm, GithubSettingsDTO>(
			useGithubSettings(),
			useUpdateGithub(),
			(data) => ({
				github_username: data.github_username,
				github_token: "",
				releases_repo: data.releases_repo,
			}),
			{ group: "github", secretFields: ["github_token"] },
		);

	return (
		<SettingsSubPage title="GitHub" description="GitHub 集成凭证" state={page}>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">GitHub 资料</h3>
				<Field label="GitHub 用户名">
					<Input {...register("github_username")} />
				</Field>
				<Field label="GitHub Token">
					<Input
						type="password"
						autoComplete="new-password"
						{...register("github_token")}
						disabled={clearedSecrets.has("github_token")}
						placeholder="留空保留现有 Token"
					/>
					<p className="text-xs text-muted-foreground">
						{snapshot?.values.github_token_set ? "已设置 Token" : "未设置 Token"}；
						{clearedSecrets.has("github_token") ? "保存后将清除" : "不会回显原文"}
					</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							clearedSecrets.has("github_token")
								? cancelSecretClear("github_token")
								: clearSecret("github_token")
						}
					>
						{clearedSecrets.has("github_token") ? "取消清除" : "清除 Token"}
					</Button>
				</Field>
				<Field label="更新日志仓库">
					<Input
						{...register("releases_repo")}
						placeholder="如 violet 或 VOD-Studio/violet"
					/>
					<p className="text-xs text-muted-foreground">
						仓库名（如 violet，owner 取上方用户名）或完整 owner/repo（如
						VOD-Studio/violet）
					</p>
				</Field>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/github")({
	component: GithubSettingsPage,
});
