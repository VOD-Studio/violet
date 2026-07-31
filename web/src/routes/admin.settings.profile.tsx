import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { Textarea } from "@shared/ui/base/textarea";
import { createFileRoute } from "@tanstack/react-router";

// 「关于」子页表单值：旧字段（tech_stack / bio / footer_text）+ A 线区块消费字段
// （avatar_url / tagline / profile 系列 / skills 系列 / social 系列）。
interface ProfileForm {
    tech_stack: string;
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
    /** B5/B6/B7 项目向区块内容（聚合 JSON 字符串） */
    project_stack: string;
    blog_numbers: string;
    thanks: string;
}

function ProfileSettingsPage() {
    const { register, isLoading, isPending, onSubmit } = useSettingsForm<ProfileForm>((data) => ({
        tech_stack: data.tech_stack,
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
        project_stack: data.project_stack,
        blog_numbers: data.blog_numbers,
        thanks: data.thanks,
    }));

    return (
        <SettingsSubPage
            title="关于"
            description="关于博主内容（头像/标语/名片/技能/社交）与旧版字段"
            isLoading={isLoading}
            isPending={isPending}
            onSubmit={onSubmit}
        >
            <section className="space-y-4">
                <h3 className="text-sm font-semibold">基础内容</h3>
                <Field label="个人简介">
                    <Textarea rows={4} {...register("bio")} />
                </Field>
                <Field label="头像 URL">
                    <Input {...register("avatar_url")} placeholder="https://..." />
                </Field>
                <Field label="一句话标语（tagline）">
                    <Input {...register("tagline")} />
                </Field>
                <Field label="页脚文案">
                    <Input {...register("footer_text")} />
                </Field>
            </section>

            <section className="space-y-4">
                <h3 className="text-sm font-semibold">名片</h3>
                <Field label="身份/职位">
                    <Input {...register("profile_role")} />
                </Field>
                <Field label="所在地">
                    <Input {...register("profile_location")} />
                </Field>
                <Field label="是否接活/合作">
                    <Input {...register("available_for")} placeholder="如：开放合作机会" />
                </Field>
            </section>

            <section className="space-y-4">
                <h3 className="text-sm font-semibold">技能/兴趣（逗号分隔）</h3>
                <Field label="擅长">
                    <Textarea rows={2} {...register("skills_strong")} />
                </Field>
                <Field label="在学">
                    <Textarea rows={2} {...register("skills_learning")} />
                </Field>
                <Field label="兴趣">
                    <Textarea rows={2} {...register("skills_interests")} />
                </Field>
                <Field label="技术栈（旧版单字符串，保留兼容）">
                    <Textarea rows={2} {...register("tech_stack")} />
                </Field>
            </section>

            <section className="space-y-4">
                <h3 className="text-sm font-semibold">社交矩阵</h3>
                <Field label="Twitter">
                    <Input {...register("social_twitter")} placeholder="https://twitter.com/..." />
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
            </section>

            <section className="space-y-4">
                <h3 className="text-sm font-semibold">项目向内容（JSON）</h3>
                <p className="text-xs text-muted-foreground">
                    以下三项以聚合 JSON 字符串存储，直接粘贴 JSON。格式见各区块说明。
                </p>
                <Field label="项目技术栈 project_stack">
                    <Textarea
                        rows={3}
                        {...register("project_stack")}
                        placeholder={'{"stack":[{"name":"Go","icon":"🐹","purpose":"后端"}]}'}
                    />
                </Field>
                <Field label="博客的数字 blog_numbers">
                    <Textarea
                        rows={3}
                        {...register("blog_numbers")}
                        placeholder={'{"numbers":[{"label":"代码行数","value":"50k"}]}'}
                    />
                </Field>
                <Field label="开源致谢 thanks">
                    <Textarea
                        rows={3}
                        {...register("thanks")}
                        placeholder={'{"thanks":[{"name":"React","url":"https://react.dev"}]}'}
                    />
                </Field>
            </section>
        </SettingsSubPage>
    );
}

export const Route = createFileRoute("/admin/settings/profile")({
    component: ProfileSettingsPage,
});
