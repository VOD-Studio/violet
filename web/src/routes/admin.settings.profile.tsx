import type { MediaFile } from "@entities/media/model/types";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import { useProfileSettings, useUpdateProfile } from "@features/admin-settings/api/queries";
import type { ProfileSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";

// 「关于」子页表单值：A 线区块消费字段（头像/标语/名片/技能/社交）+ bio/footer_text。
interface ProfileForm {
    bio: string;
    footer_text: string;
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
        footer_text: data.footer_text,
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
                            onChange={(url) => setValue("avatar_url", url, { shouldDirty: true })}
                        />
                        <span className="text-sm font-medium">头像</span>
                    </div>
                    {/* 右栏：字段（标语/页脚并排，简介在下方同宽） */}
                    <div className="grid flex-1 grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="一句话标语">
                                <Input
                                    {...register("tagline")}
                                    placeholder="如：全栈开发者 / 独立创造者"
                                />
                            </Field>
                            <Field label="页脚文案">
                                <Input
                                    {...register("footer_text")}
                                    placeholder="如：© 2026 Your Name"
                                />
                            </Field>
                        </div>
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

/**
 * 头像选择器：固定 64px 圆形容器。
 * 整个容器可点击打开素材库；有头像时悬浮显示半透明遮罩。
 * 删除按钮 absolute 在容器内部右上角（不占布局空间，group-hover 可见）。
 */
function AvatarPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group relative size-16 shrink-0 overflow-visible rounded-full border border-edge-hairline transition-colors hover:border-primary/50"
                aria-label={value ? "更换头像" : "选择头像"}
            >
                <span className="block size-full overflow-hidden rounded-full">
                    {value ? (
                        <img src={value} alt="头像" className="size-full object-cover" />
                    ) : (
                        <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                            <ImagePlus className="size-4" />
                        </span>
                    )}
                    {/* 悬浮遮罩（有头像时） */}
                    {value ? (
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                            更换
                        </span>
                    ) : null}
                </span>
                {/* 删除按钮：absolute 在容器内右上角，不占布局 */}
                {value ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange("");
                        }}
                        className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow-sm transition-opacity hover:opacity-100 group-hover:opacity-100"
                        aria-label="移除头像"
                    >
                        <X className="size-3" />
                    </button>
                ) : null}
            </button>
            <MediaPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                mediaType="image"
                title="选择头像"
                onConfirm={(files: MediaFile[]) => {
                    if (files[0]) onChange(files[0].url);
                    setPickerOpen(false);
                }}
            />
        </>
    );
}

export const Route = createFileRoute("/admin/settings/profile")({
    component: ProfileSettingsPage,
});
