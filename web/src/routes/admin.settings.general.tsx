import { useGeneralSettings, useUpdateGeneral } from "@features/admin-settings/api/queries";
import type { GeneralSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field, SwitchField } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { Controller } from "react-hook-form";

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
    const { register, control, isLoading, isPending, onSubmit } = useSettingsForm<
        GeneralForm,
        GeneralSettingsDTO
    >(useGeneralSettings(), useUpdateGeneral(), (data) => ({
        site_name: data.site_name,
        site_description: data.site_description,
        site_url: data.site_url,
        admin_email: data.admin_email,
        posts_per_page: data.posts_per_page,
        comments_enabled: data.comments_enabled,
        comments_moderation: data.comments_moderation,
    }));

    return (
        <SettingsSubPage
            title="基础信息"
            description="站点名称、描述与访问控制"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
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
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/general")({
    component: GeneralSettingsPage,
});
