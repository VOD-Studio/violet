import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import { Field, SwitchField } from "@features/admin-settings/ui/settings-fields";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

/** 基础信息子页表单值（仅本页字段） */
interface GeneralForm {
    site_name: string;
    site_description: string;
    site_url: string;
    admin_email: string;
    posts_per_page: number;
    comments_enabled: boolean;
    comments_moderation: boolean;
}

function GeneralSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();
    const { register, handleSubmit, reset, control } = useForm<GeneralForm>();

    useEffect(() => {
        if (data) {
            reset({
                site_name: data.site_name,
                site_description: data.site_description,
                site_url: data.site_url,
                admin_email: data.admin_email,
                posts_per_page: data.posts_per_page,
                comments_enabled: data.comments_enabled,
                comments_moderation: data.comments_moderation,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: GeneralForm) => updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="基础信息" description="站点名称、描述与访问控制">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="基础信息" description="站点名称、描述与访问控制">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">站点信息</h3>
                    <Field label="站点名称">
                        <Input {...register("site_name")} />
                    </Field>
                    <Field label="站点描述">
                        <Textarea rows={2} {...register("site_description")} />
                    </Field>
                    <Field label="站点 URL">
                        <Input {...register("site_url")} />
                    </Field>
                    <Field label="管理员邮箱">
                        <Input type="email" {...register("admin_email")} />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">内容</h3>
                    <Field label="每页文章数">
                        <Input
                            type="number"
                            {...register("posts_per_page", {
                                valueAsNumber: true,
                            })}
                        />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">评论</h3>
                    <Controller
                        control={control}
                        name="comments_enabled"
                        render={({ field }) => (
                            <SwitchField
                                label="启用评论"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="comments_moderation"
                        render={({ field }) => (
                            <SwitchField
                                label="评论需审核"
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

export const Route = createFileRoute("/admin/settings/general")({
    component: GeneralSettingsPage,
});
