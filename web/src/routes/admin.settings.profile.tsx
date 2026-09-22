import { AvatarPicker } from "@entities/media/ui/AvatarPicker";
import { useProfileSettings, useUpdateProfile } from "@features/admin-settings/api/queries";
import type { ProfileSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";

// 「关于」子页表单值：A 线区块消费字段（头像/标语/名片/技能/社交）+ bio。
interface ProfileForm {
	bio: string;
	avatar_url: string;
	tagline: string;
	profile_role: string;
	profile_location: string;
	available_for: string;
	skills_strong: string;
	skills_learning: string;
	skills_interests: string;
	social_twitter: string;
	social_mastodon: string;
	social_email: string;
	social_rss: string;
	social_bilibili: string;
}

function ProfileSettingsPage() {
	const { register, watch, setValue, isLoading, isPending, onSubmit } = useSettingsForm<
		ProfileForm,
		ProfileSettingsDTO
	>(useProfileSettings(), useUpdateProfile(), (data) => ({
		bio: data.bio,
		avatar_url: data.avatar_url,
		tagline: data.tagline,
		profile_role: data.profile_role,
		profile_location: data.profile_location,
		available_for: data.available_for,
		skills_strong: data.skills_strong,
		skills_learning: data.skills_learning,
		skills_interests: data.skills_interests,
		social_twitter: data.social_twitter,
		social_mastodon: data.social_mastodon,
		social_email: data.social_email,
		social_rss: data.social_rss,
		social_bilibili: data.social_bilibili,
	}));

	return (
		<SettingsSubPage
			title="关于"
			description="关于博主内容（头像/标语/名片/技能/社交）"
			isLoading={isLoading}
			isPending={isPending}
			onSubmit={onSubmit}
		>
			{/* 博主身份：左栏头像 + 右栏字段 */}
			<section className="rounded-lg border border-edge-hairline p-5">
				<h3 className="mb-3 text-base font-semibold">博主身份</h3>
				<div className="flex items-start gap-6">
					{/* 左栏：头像 */}
					<div className="flex shrink-0 flex-col items-center gap-1.5">
						<AvatarPicker
							value={watch("avatar_url")}
							onChange={(file) =>
								setValue("avatar_url", file?.url ?? "", { shouldDirty: true })
							}
						/>
						<span className="text-sm font-medium">头像</span>
					</div>
					{/* 右栏：字段（标语 + 简介） */}
					<div className="grid flex-1 grid-cols-1 gap-3">
						<Field label="一句话标语">
							<Input
								{...register("tagline")}
								placeholder="如：全栈开发者 / 独立创造者"
							/>
						</Field>
						<Field label="个人简介">
							<Textarea rows={4} {...register("bio")} />
						</Field>
					</div>
				</div>
			</section>

			{/* 名片 */}
			<section className="rounded-lg border border-edge-hairline p-5">
				<h3 className="mb-3 text-base font-semibold">名片</h3>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<Field label="所在地">
						<Input {...register("profile_location")} />
					</Field>
					<Field label="是否接活/合作">
						<Input {...register("available_for")} placeholder="如：开放合作机会" />
					</Field>
				</div>
			</section>

			{/* 技能/兴趣 */}
			<section className="rounded-lg border border-edge-hairline p-5">
				<h3 className="mb-3 text-base font-semibold">技能/兴趣（逗号分隔）</h3>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<Field label="擅长">
						<Textarea rows={3} {...register("skills_strong")} />
					</Field>
					<Field label="在学">
						<Textarea rows={3} {...register("skills_learning")} />
					</Field>
					<Field label="兴趣">
						<Textarea rows={3} {...register("skills_interests")} />
					</Field>
				</div>
			</section>

			{/* 社交矩阵：大屏 5 列铺满 */}
			<section className="rounded-lg border border-edge-hairline p-5">
				<h3 className="mb-3 text-base font-semibold">社交矩阵</h3>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					<Field label="Twitter">
						<Input
							{...register("social_twitter")}
							placeholder="https://twitter.com/..."
						/>
					</Field>
					<Field label="Mastodon">
						<Input {...register("social_mastodon")} placeholder="https://..." />
					</Field>
					<Field label="Email">
						<Input type="email" {...register("social_email")} />
					</Field>
					<Field label="RSS">
						<Input {...register("social_rss")} placeholder="https://.../rss" />
					</Field>
					<Field label="Bilibili">
						<Input {...register("social_bilibili")} placeholder="https://..." />
					</Field>
				</div>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/profile")({
	component: ProfileSettingsPage,
});
