import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import { SwitchField } from "@features/admin-settings/ui/settings-fields";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

/** 认证子页表单值（仅本页字段） */
interface AuthForm {
    google_login_enabled: boolean;
    github_login_enabled: boolean;
}

function AuthSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();
    const { handleSubmit, reset, control } = useForm<AuthForm>();

    useEffect(() => {
        if (data) {
            reset({
                google_login_enabled: data.google_login_enabled,
                github_login_enabled: data.github_login_enabled,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: AuthForm) => updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="认证" description="第三方登录开关">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="认证" description="第三方登录开关">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">第三方登录</h3>
                    <Controller
                        control={control}
                        name="google_login_enabled"
                        render={({ field }) => (
                            <SwitchField
                                label="启用 Google 登录"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="github_login_enabled"
                        render={({ field }) => (
                            <SwitchField
                                label="启用 GitHub 登录"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
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

export const Route = createFileRoute("/admin/settings/auth")({
    component: AuthSettingsPage,
});
