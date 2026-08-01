import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AboutConfig, AboutSection } from "@features/about/model/about-config";
import { ABOUT_SECTION_IDS, ABOUT_SECTION_LABELS } from "@features/about/ui/section-registry";
import {
    useAboutSettings,
    useGithubSettings,
    useUpdateAbout,
} from "@features/admin-settings/api/queries";
import type { AboutSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Switch } from "@shared/ui/base/switch";
import { createFileRoute } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";

/**
 * 关于页配置表单值（仅 about_config 字段，原生 JSON 对象）。
 *
 * 内部用 AboutSection[] 编辑（开关 + 拖拽排序），提交时直接提交对象（后端 json.RawMessage 接收）。
 */
interface AboutSettingsForm {
    about_config: AboutConfig | null;
}

function AboutConfigPage() {
    const { watch, setValue, isLoading, isPending, onSubmit } = useSettingsForm<
        AboutSettingsForm,
        AboutSettingsDTO
    >(useAboutSettings(), useUpdateAbout(), (data) => ({
        about_config: data.about_config ?? null,
    }));
    // 读 github 组配置判断 releases_repo 是否已配置（更新日志区块依赖它，属跨组只读）
    const { data: githubSettings } = useGithubSettings();
    const releasesRepoConfigured = !!githubSettings?.releases_repo;

    // watch about_config 对象，派生可编辑的 sections 列表。
    // setValue 改对象后 watch 触发重渲染，保持单向数据流：编辑 sections → 同步回对象。
    const watchConfig = watch("about_config");
    const sections = watchConfig?.sections ?? [];

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

    /** 把 sections 列表写回 about_config 对象 */
    const syncToConfig = (next: AboutSection[]) => {
        setValue(
            "about_config",
            { sections: next },
            {
                shouldDirty: true,
            },
        );
    };

    const toggleEnabled = (id: string, enabled: boolean) => {
        syncToConfig(fullSections.map((s) => (s.id === id ? { ...s, enabled } : s)));
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    /** 拖拽结束：用 arrayMove 重排后把新 index 作为 order 写回 */
    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = fullSections.findIndex((s) => s.id === active.id);
        const newIndex = fullSections.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const reordered = arrayMove(fullSections, oldIndex, newIndex);
        syncToConfig(reordered.map((s, i) => ({ ...s, order: i })));
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
                    打开开关显示该区块；拖拽手柄调整显示顺序。未配置过的区块默认关闭。
                </p>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={fullSections.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {fullSections.map((section) => (
                                <SortableSectionItem
                                    key={section.id}
                                    section={section}
                                    releasesRepoConfigured={releasesRepoConfigured}
                                    onToggle={toggleEnabled}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </section>
        </SettingsSubPage>
    );
}

/** 可拖拽的区块列表项 */
function SortableSectionItem({
    section,
    releasesRepoConfigured,
    onToggle,
}: {
    section: AboutSection;
    releasesRepoConfigured: boolean;
    onToggle: (id: string, enabled: boolean) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between rounded-md border border-edge-hairline px-4 py-3"
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    aria-label="拖拽排序"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
                <div>
                    <span className="text-sm font-medium">
                        {ABOUT_SECTION_LABELS[section.id] ?? section.id}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {section.id}
                    </span>
                    {section.id === "changelog" && !releasesRepoConfigured && (
                        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            需先在「GitHub 设置」配置 releases_repo
                        </p>
                    )}
                </div>
            </div>
            <Switch checked={section.enabled} onCheckedChange={(v) => onToggle(section.id, v)} />
        </div>
    );
}

export const Route = createFileRoute("/admin/settings/about")({
    component: AboutConfigPage,
});
