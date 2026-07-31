import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { SwitchField } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { createFileRoute } from "@tanstack/react-router";
import { Controller } from "react-hook-form";

/** 认证子页表单值（仅本页字段） */
interface AuthForm {
    google_login_enabled: boolean;
    github_login_enabled: boolean;
}

function AuthSettingsPage() {
    const { control, isLoading, isPending, onSubmit } = useSettingsForm<AuthForm>((data) => ({
        google_login_enabled: data.google_login_enabled,
        github_login_enabled: data.github_login_enabled,
    }));

    return (
        <SettingsSubPage
            title="认证"
            description="第三方登录开关"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
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
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/auth")({
    component: AuthSettingsPage,
});
