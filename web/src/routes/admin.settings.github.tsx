import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

/** GitHub 子页表单值（仅本页字段） */
interface GithubForm {
    github_username: string;
    github_token: string;
}

function GithubSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();
    const { register, handleSubmit, reset } = useForm<GithubForm>();

    useEffect(() => {
        if (data) {
            reset({
                github_username: data.github_username,
                github_token: data.github_token,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: GithubForm) => updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="GitHub" description="GitHub 集成凭证">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="GitHub" description="GitHub 集成凭证">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">GitHub 资料</h3>
                    <Field label="GitHub 用户名">
                        <Input {...register("github_username")} />
                    </Field>
                    <Field label="GitHub Token">
                        <Input type="password" {...register("github_token")} />
                    </Field>
                </section>

                <PermissionGuard permission="settings:update">
                    <Button type="submit" disabled={updateMut.isPending}>
                        {updateMut.isPending ? "保存中…" : "保存设置"}
                    </Button>
                </PermissionGuard>
            </form>
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/settings/github")({
    component: GithubSettingsPage,
});
