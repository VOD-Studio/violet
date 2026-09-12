import { useGeneralSettings, useUpdateGeneral } from "@features/admin-settings/api/queries";
import type { GeneralSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field, SwitchField } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import {
	HOME_FOOTPRINT_AGGREGATION_MAX_DAYS,
	HOME_FOOTPRINT_AGGREGATION_MIN_DAYS,
} from "@features/settings/model/types";

import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";
import { Controller } from "react-hook-form";

/** 基础信息子页表单值（仅本页字段） */
interface GeneralForm {
	site_name: string;
	site_url: string;
	footer_text: string;
	footer_github_url: string;
	posts_per_page: number;
	home_footprint_enabled: boolean;
	home_footprint_aggregation_days: number;
	comments_enabled: boolean;
	comments_moderation: boolean;
	custom_emoji_max_per_user: number;
}

function GeneralSettingsPage() {
	const { register, control, page } = useSettingsForm<GeneralForm, GeneralSettingsDTO>(
		useGeneralSettings(),
		useUpdateGeneral(),
		(data) => ({
			site_name: data.site_name,
			site_url: data.site_url,
			footer_text: data.footer_text,
			footer_github_url: data.footer_github_url,
			posts_per_page: data.posts_per_page,
			home_footprint_enabled: data.home_footprint_enabled,
			home_footprint_aggregation_days: data.home_footprint_aggregation_days,
			comments_enabled: data.comments_enabled,
			comments_moderation: data.comments_moderation,
			custom_emoji_max_per_user: data.custom_emoji_max_per_user,
		}),
		{ group: "general" },
	);

	return (
		<SettingsSubPage title="基础信息" description="站点名称、描述与访问控制" state={page}>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">站点信息</h3>
				<Field label="站点名称">
					<Input {...register("site_name", { required: "请填写站点名称" })} />
				</Field>
				<Field label="站点 URL">
					<Input {...register("site_url")} />
				</Field>
				<Field label="页脚文案">
					<Input {...register("footer_text")} />
				</Field>
				<Field label="页脚 GitHub URL">
					<Input
						{...register("footer_github_url", {
							validate: (value) => {
								if (value === "") return true;
								try {
									const url = new URL(value);
									return (
										(url.protocol === "https:" &&
											url.hostname.toLowerCase() === "github.com" &&
											!url.port &&
											/^\/[^/]+(?:\/[^/]+)?\/?$/.test(url.pathname)) ||
										"请输入 HTTPS 的 github.com 账号或仓库 URL"
									);
								} catch {
									return "请输入完整的 HTTPS GitHub URL，或留空隐藏";
								}
							},
						})}
						placeholder="https://github.com/VOD-Studio/violet"
					/>
					<p className="text-xs text-muted-foreground">
						留空隐藏页脚链接；不会改变贡献图账号。保存时移除凭据、查询参数与锚点。
					</p>
				</Field>
			</section>

			<section className="space-y-4">
				<h3 className="text-sm font-semibold">内容</h3>
				<Field label="每页文章数">
					<Input
						type="number"
						{...register("posts_per_page", {
							valueAsNumber: true,
							min: { value: 1, message: "每页文章数至少为 1" },
						})}
					/>
				</Field>
			</section>

			<section className="space-y-4">
				<h3 className="text-sm font-semibold">首页发布足迹</h3>
				<Controller
					control={control}
					name="home_footprint_enabled"
					render={({ field }) => (
						<SwitchField
							label="显示发布足迹"
							checked={field.value}
							onCheckedChange={field.onChange}
						/>
					)}
				/>
				<Field label="节点聚合天数">
					<Input
						type="number"
						min={HOME_FOOTPRINT_AGGREGATION_MIN_DAYS}
						max={HOME_FOOTPRINT_AGGREGATION_MAX_DAYS}
						{...register("home_footprint_aggregation_days", {
							valueAsNumber: true,
							min: {
								value: HOME_FOOTPRINT_AGGREGATION_MIN_DAYS,
								message: `不能小于 ${HOME_FOOTPRINT_AGGREGATION_MIN_DAYS} 天`,
							},
							max: {
								value: HOME_FOOTPRINT_AGGREGATION_MAX_DAYS,
								message: `不能大于 ${HOME_FOOTPRINT_AGGREGATION_MAX_DAYS} 天`,
							},
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
				<h3 className="text-sm font-semibold">表情</h3>
				<Field label="单用户自定义表情上限（自传 + 收藏合计）">
					<Input
						type="number"
						min={0}
						{...register("custom_emoji_max_per_user", {
							valueAsNumber: true,
							min: { value: 0, message: "不能为负数" },
						})}
					/>
					<p className="text-xs text-muted-foreground">
						设为 0 后禁止新增，不删除已有表情。
					</p>
				</Field>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/general")({
	component: GeneralSettingsPage,
});
