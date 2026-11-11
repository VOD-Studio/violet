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
import { createFileRoute } from "@tanstack/react-router";
import { Sortable, Switch } from "@violet/ui";

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

	const reorderSections = (next: AboutSection[]) => {
		syncToConfig(next.map((section, order) => ({ ...section, order })));
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
				<Sortable
					aria-label="关于页区块顺序"
					items={fullSections}
					getId={(section) => section.id}
					getLabel={(section) => ABOUT_SECTION_LABELS[section.id] ?? section.id}
					disabled={isPending}
					onReorder={reorderSections}
					renderItem={(section) => (
						<SectionItem
							section={section}
							releasesRepoConfigured={releasesRepoConfigured}
							onToggle={toggleEnabled}
						/>
					)}
				/>
			</section>
		</SettingsSubPage>
	);
}

function SectionItem({
	section,
	releasesRepoConfigured,
	onToggle,
}: {
	section: AboutSection;
	releasesRepoConfigured: boolean;
	onToggle: (id: string, enabled: boolean) => void;
}) {
	return (
		<div className="flex min-h-8 items-center justify-between gap-3">
			<div>
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
			<Switch
				aria-label={`显示${ABOUT_SECTION_LABELS[section.id] ?? section.id}`}
				checked={section.enabled}
				onCheckedChange={(value) => onToggle(section.id, value)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/admin/settings/about")({
	component: AboutConfigPage,
});
