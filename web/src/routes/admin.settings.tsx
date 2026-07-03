import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import type { UpdateSettingsRequest } from "@features/admin-settings/model/types";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Switch } from "@shared/ui/base/switch";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

function AdminSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();

    const { register, handleSubmit, reset, control } = useForm<UpdateSettingsRequest>();

    // 配置加载完成后回填表单
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
                google_login_enabled: data.google_login_enabled,
                github_login_enabled: data.github_login_enabled,
                github_username: data.github_username,
                github_token: data.github_token,
                tech_stack: data.tech_stack,
                bio: data.bio,
                footer_text: data.footer_text,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: UpdateSettingsRequest) => updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="站点设置" description="管理站点全局配置">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="站点设置" description="管理站点全局配置">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">基础信息</h3>
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

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">认证</h3>
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

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">GitHub 资料</h3>
                    <Field label="GitHub 用户名">
                        <Input {...register("github_username")} />
                    </Field>
                    <Field label="GitHub Token">
                        <Input type="password" {...register("github_token")} />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">关于</h3>
                    <Field label="技术栈">
                        <Textarea rows={2} {...register("tech_stack")} />
                    </Field>
                    <Field label="个人简介">
                        <Textarea rows={4} {...register("bio")} />
                    </Field>
                    <Field label="页脚文案">
                        <Input {...register("footer_text")} />
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

/** Field - 标签 + 控件包装 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    const id = React.useId();
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            {/* 通过 cloneElement 给子控件注入 id，建立 label 关联 */}
            {React.cloneElement(children as React.ReactElement<{ id?: string }>, {
                id,
            })}
        </div>
    );
}

/** SwitchField - 开关字段 */
function SwitchField({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

export const Route = createFileRoute("/admin/settings")({
    component: AdminSettingsPage,
});
