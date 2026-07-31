import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminSettings, useUpdateSettings } from "@features/admin-settings/api/queries";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

/**
 * 「关于」子页表单值（仅本页字段）
 *
 * 注：tech_stack / bio / footer_text 当前仍是单字符串/纯文本，
 * 后续 PRD-0009 Issue-0002/0003 会将这里改造为「关于页区块配置」入口。
 */
interface ProfileForm {
    tech_stack: string;
    bio: string;
    footer_text: string;
}

function ProfileSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();
    const { register, handleSubmit, reset } = useForm<ProfileForm>();

    useEffect(() => {
        if (data) {
            reset({
                tech_stack: data.tech_stack,
                bio: data.bio,
                footer_text: data.footer_text,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: ProfileForm) => updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="关于" description="关于页内容（后续将改造为区块配置）">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="关于" description="关于页内容（后续将改造为区块配置）">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
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

export const Route = createFileRoute("/admin/settings/profile")({
    component: ProfileSettingsPage,
});
