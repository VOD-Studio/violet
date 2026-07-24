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
                llm_api_key: data.llm_api_key ?? "",
                llm_api_url: data.llm_api_url ?? "",
                llm_model: data.llm_model ?? "",
                llm_protocol: data.llm_protocol ?? "openai",
                // 代码运行器（数值字段后端返回 0 表示未配置，前端显示默认值）
                code_runner_enabled: data.code_runner_enabled ?? true,
                code_runner_max_cpu_cores: data.code_runner_max_cpu_cores || 2,
                code_runner_max_memory_mb: data.code_runner_max_memory_mb || 1024,
                code_runner_max_timeout_secs: data.code_runner_max_timeout_secs || 30,
                code_runner_max_output_bytes: data.code_runner_max_output_bytes || 1048576,
                code_runner_max_source_bytes: data.code_runner_max_source_bytes || 65536,
                code_runner_allow_network: data.code_runner_allow_network ?? false,
                code_runner_languages: data.code_runner_languages ?? "",
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

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">LLM 配置</h3>
                    <p className="text-xs text-muted-foreground">
                        配置 OpenAI 协议兼容端点（OpenAI / DeepSeek / Moonshot / 通义 / 智谱 /
                        Ollama / vLLM），用于「导入链接」时的 AI 公式还原等功能。留空则禁用 AI
                        能力。
                    </p>
                    <Field label="API Key">
                        <Input type="password" {...register("llm_api_key")} placeholder="sk-..." />
                    </Field>
                    <Field label="API Base URL">
                        <Input
                            {...register("llm_api_url")}
                            placeholder="https://api.openai.com/v1"
                        />
                    </Field>
                    <Field label="模型名">
                        <Input {...register("llm_model")} placeholder="gpt-4o-mini" />
                    </Field>
                    <Field label="协议">
                        <Input {...register("llm_protocol")} placeholder="openai" />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">代码运行器</h3>
                    <p className="text-xs text-muted-foreground">
                        配置可运行代码块的沙箱执行。需 api 容器挂载 docker.sock 且
                        yggdrasil-runner-* 镜像已 load。改动立即生效，无需重启。 详见 ADR-0006。
                    </p>
                    <Controller
                        control={control}
                        name="code_runner_enabled"
                        render={({ field }) => (
                            <SwitchField
                                label="启用代码运行器"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="code_runner_allow_network"
                        render={({ field }) => (
                            <SwitchField
                                label="允许网络（需作者声明+语言允许+此开关三者取与）"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Field label="CPU 上限（核数）">
                        <Input
                            type="number"
                            step="0.1"
                            {...register("code_runner_max_cpu_cores", { valueAsNumber: true })}
                        />
                    </Field>
                    <Field label="内存上限（MB）">
                        <Input
                            type="number"
                            {...register("code_runner_max_memory_mb", { valueAsNumber: true })}
                        />
                    </Field>
                    <Field label="超时上限（秒）">
                        <Input
                            type="number"
                            {...register("code_runner_max_timeout_secs", { valueAsNumber: true })}
                        />
                    </Field>
                    <Field label="输出上限（字节）">
                        <Input
                            type="number"
                            {...register("code_runner_max_output_bytes", { valueAsNumber: true })}
                        />
                    </Field>
                    <Field label="源码上限（字节）">
                        <Input
                            type="number"
                            {...register("code_runner_max_source_bytes", { valueAsNumber: true })}
                        />
                    </Field>
                    <Field label="语言白名单（逗号分隔 canonical key，空=全部）">
                        <Input
                            {...register("code_runner_languages")}
                            placeholder="python,node,go,rust,bun"
                        />
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
