import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";

/** GitHub 子页表单值（仅本页字段） */
interface GithubForm {
    github_username: string;
    github_token: string;
    releases_repo: string;
}

function GithubSettingsPage() {
    const { register, isLoading, isPending, onSubmit } = useSettingsForm<GithubForm>((data) => ({
        github_username: data.github_username,
        github_token: data.github_token,
        releases_repo: data.releases_repo,
    }));

    return (
        <SettingsSubPage
            title="GitHub"
            description="GitHub 集成凭证"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
            <section className="space-y-4">
                <h3 className="text-sm font-semibold">GitHub 资料</h3>
                <Field label="GitHub 用户名">
                    <Input {...register("github_username")} />
                </Field>
                <Field label="GitHub Token">
                    <Input type="password" {...register("github_token")} />
                </Field>
                <Field label="更新日志仓库名">
                    <Input
                        {...register("releases_repo")}
                        placeholder="如 violet（配合用户名拼 owner/repo）"
                    />
                </Field>
            </section>
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/github")({
    component: GithubSettingsPage,
});
