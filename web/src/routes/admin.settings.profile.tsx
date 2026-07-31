import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";

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
    const { register, isLoading, isPending, onSubmit } = useSettingsForm<ProfileForm>((data) => ({
        tech_stack: data.tech_stack,
        bio: data.bio,
        footer_text: data.footer_text,
    }));

    return (
        <SettingsSubPage
            title="关于"
            description="关于页内容（后续将改造为区块配置）"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
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
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/profile")({
    component: ProfileSettingsPage,
});
