import { useCodeRunnerSettings, useUpdateCodeRunner } from "@features/admin-settings/api/queries";
import type { CodeRunnerSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field, SwitchField } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";
import { Controller } from "react-hook-form";

/** 代码运行器子页表单值（仅本页字段） */
interface CodeRunnerForm {
    code_runner_enabled: boolean;
    code_runner_max_cpu_cores: number;
    code_runner_max_memory_mb: number;
    code_runner_max_timeout_secs: number;
    code_runner_max_output_bytes: number;
    code_runner_max_source_bytes: number;
    code_runner_allow_network: boolean;
    code_runner_languages: string;
}

function CodeRunnerSettingsPage() {
    const { register, control, isLoading, isPending, onSubmit } = useSettingsForm<
        CodeRunnerForm,
        CodeRunnerSettingsDTO
    >(
        useCodeRunnerSettings(),
        useUpdateCodeRunner(),
        // 数值字段后端返回 0 表示未配置，前端显示默认值
        (data) => ({
            code_runner_enabled: data.code_runner_enabled ?? true,
            code_runner_max_cpu_cores: data.code_runner_max_cpu_cores || 2,
            code_runner_max_memory_mb: data.code_runner_max_memory_mb || 1024,
            code_runner_max_timeout_secs: data.code_runner_max_timeout_secs || 30,
            code_runner_max_output_bytes: data.code_runner_max_output_bytes || 1048576,
            code_runner_max_source_bytes: data.code_runner_max_source_bytes || 65536,
            code_runner_allow_network: data.code_runner_allow_network ?? false,
            code_runner_languages: data.code_runner_languages ?? "",
        }),
    );

    return (
        <SettingsSubPage
            title="代码运行器"
            description="可运行代码块沙箱执行配置"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
            <section className="space-y-4">
                <h3 className="text-sm font-semibold">代码运行器</h3>
                <p className="text-xs text-muted-foreground">
                    配置可运行代码块的沙箱执行。需 api 容器挂载 docker.sock 且 yggdrasil-runner-*
                    镜像已 load。改动立即生效，无需重启。详见 ADR-0006。
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
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/code-runner")({
    component: CodeRunnerSettingsPage,
});
