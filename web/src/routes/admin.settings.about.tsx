import {
    type AboutSection,
    parseAboutConfig,
    stringifyAboutConfig,
} from "@features/about/model/about-config";
import { ABOUT_SECTION_IDS, ABOUT_SECTION_LABELS } from "@features/about/ui/section-registry";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * 关于页配置表单值（仅 about_config 字段）。
 *
 * 内部用 AboutSection[] 编辑（开关 + 排序），提交时序列化回 about_config JSON 字符串。
 */
interface AboutSettingsForm {
    about_config: string;
}

function AboutConfigPage() {
    const { register, watch, setValue, isLoading, isPending, onSubmit } =
        useSettingsForm<AboutSettingsForm>((data) => ({
            about_config: data.about_config ?? "",
        }));

    // 用 watch 监听 about_config 字符串，派生出可编辑的 sections 列表。
    // setValue 改字符串后 watch 触发重渲染，保持单向数据流：编辑 sections → 同步回字符串。
    const rawConfig = watch("about_config");
    const sections = parseAboutConfig(rawConfig).sections;

    /** 确保所有已知区块都有条目（未配置的补 enabled:false） */
    const fullSections: AboutSection[] = ABOUT_SECTION_IDS.map((id) => {
        const existing = sections.find((s) => s.id === id);
        return (
            existing ?? {
                id,
                enabled: false,
                order: ABOUT_SECTION_IDS.indexOf(id),
            }
        );
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    /** 把 sections 列表写回 about_config 字符串 */
    const syncToConfig = (next: AboutSection[]) => {
        setValue("about_config", stringifyAboutConfig({ sections: next }), {
            shouldDirty: true,
        });
    };

    const toggleEnabled = (id: string, enabled: boolean) => {
        syncToConfig(fullSections.map((s) => (s.id === id ? { ...s, enabled } : s)));
    };

    const moveSection = (index: number, direction: "up" | "down") => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= fullSections.length) return;
        const next = [...fullSections];
        // 交换两者的 order 值实现位移
        const a = next[index];
        const b = next[target];
        const aOrder = a.order ?? index;
        a.order = b.order ?? target;
        b.order = aOrder;
        syncToConfig(next);
    };

    return (
        <SettingsSubPage
            title="关于页配置"
            description="控制关于页各区块的显示与顺序"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
            <section className="space-y-3">
                <h3 className="text-sm font-semibold">区块列表</h3>
                <p className="text-xs text-muted-foreground">
                    打开开关显示该区块；用上下箭头调整显示顺序。未配置过的区块默认关闭。
                </p>
                {/* register 占位：保证 about_config 字段被 react-hook-form 跟踪，实际值由 syncToConfig 维护 */}
                <input type="hidden" {...register("about_config")} />
                <div className="space-y-1">
                    {fullSections.map((section, index) => (
                        <div
                            key={section.id}
                            className="flex items-center justify-between rounded-md border border-edge-hairline px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={index === 0}
                                        onClick={() => moveSection(index, "up")}
                                        aria-label="上移"
                                    >
                                        <ChevronUp className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={index === fullSections.length - 1}
                                        onClick={() => moveSection(index, "down")}
                                        aria-label="下移"
                                    >
                                        <ChevronDown className="size-4" />
                                    </Button>
                                </div>
                                <div>
                                    <span className="text-sm font-medium">
                                        {ABOUT_SECTION_LABELS[section.id] ?? section.id}
                                    </span>
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                                        {section.id}
                                    </span>
                                </div>
                            </div>
                            <Switch
                                checked={section.enabled}
                                onCheckedChange={(v) => toggleEnabled(section.id, v)}
                            />
                        </div>
                    ))}
                </div>
            </section>
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/about")({
    component: AboutConfigPage,
});
