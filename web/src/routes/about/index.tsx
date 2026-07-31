import { parseAboutConfig, resolveSectionOrder } from "@features/about/model/about-config";
import { resolveSectionComponent } from "@features/about/ui/section-registry";
import { useSettings } from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";
import { Code, ExternalLink } from "lucide-react";
import { motion } from "motion/react";

/**
 * /about - 关于页
 *
 * 数据来自 useSettings（已全局预取）。
 *
 * 渲染模式（Issue-0002 引入区块版面配置）：
 * - 站长未配置 about_config（空串）→ 回退默认渲染（Hero/简介/技术栈/社交 4 区块），
 *   保证现有页面不破坏。
 * - 已配置 about_config → 解析 sections，按 order 排序、enabled 过滤，
 *   用区块注册表（section-registry）把每个 id 映射到对应组件渲染。
 *   未实现的区块用占位组件（后续 issue 逐个填实）。
 *
 * 区块真实组件见 features/about/ui/，注册表统一映射 id → 组件。
 */
function AboutPage() {
    const { data: settings, isLoading } = useSettings();

    if (isLoading || !settings) {
        return (
            <div className="container mx-auto px-6 py-32">
                <div className="mx-auto max-w-2xl animate-pulse space-y-4">
                    <div className="mx-auto h-12 w-48 rounded bg-muted" />
                    <div className="mx-auto h-4 w-72 rounded bg-muted" />
                </div>
            </div>
        );
    }

    const config = parseAboutConfig(settings.about_config);
    const orderedIds = resolveSectionOrder(config);

    // 配置为空 → 回退默认渲染（向后兼容，保护现有页面）
    if (orderedIds.length === 0) {
        return <AboutDefaultSections settings={settings} />;
    }

    // 配置模式：按 about_config 遍历渲染区块
    return (
        <div className="flex flex-col">
            {orderedIds.map((id) => {
                const Section = resolveSectionComponent(id);
                const section = config.sections.find((s) => s.id === id) ?? {
                    id,
                    enabled: true,
                };
                return <Section key={id} section={section} settings={settings} />;
            })}
        </div>
    );
}

/** 默认渲染（about_config 未配置时的回退，对齐原有 4 区块布局） */
function AboutDefaultSections({
    settings,
}: {
    settings: NonNullable<ReturnType<typeof useSettings>["data"]>;
}) {
    const techStack = settings.tech_stack
        ? settings.tech_stack
              .split(/[,，、\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
        : [];

    return (
        <div className="flex flex-col">
            {/* Hero 区 */}
            <section className="relative flex h-[60vh] items-center justify-center overflow-hidden bg-background">
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-blue-400/30 mix-blend-multiply blur-3xl animate-blob" />
                    <div className="absolute right-1/4 top-1/3 size-96 rounded-full bg-purple-400/30 mix-blend-multiply blur-3xl animate-blob [animation-delay:2s]" />
                </div>

                <div className="z-10 flex flex-col items-center px-6 text-center">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground"
                    >
                        About
                    </motion.p>
                    <motion.h1
                        initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="mb-4 text-5xl font-black tracking-tighter md:text-7xl"
                    >
                        {settings.site_name || "关于"}
                    </motion.h1>
                    {settings.site_description ? (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8, duration: 1 }}
                            className="max-w-xl text-base text-foreground/60"
                        >
                            {settings.site_description}
                        </motion.p>
                    ) : null}
                </div>
            </section>

            {/* 个人简介 */}
            {settings.bio ? (
                <section className="container mx-auto px-6 py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mx-auto max-w-2xl"
                    >
                        <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            简介
                        </h2>
                        <p className="whitespace-pre-line text-lg leading-relaxed text-foreground/80">
                            {settings.bio}
                        </p>
                    </motion.div>
                </section>
            ) : null}

            {/* 技术栈 */}
            {techStack.length > 0 ? (
                <section className="container mx-auto px-6 py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mx-auto max-w-2xl"
                    >
                        <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            技术栈
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {techStack.map((tech, i) => (
                                <motion.span
                                    key={tech}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: i * 0.04 }}
                                    className="rounded-lg border border-edge-hairline bg-muted/30 px-3 py-1.5 font-mono text-sm transition-colors hover:border-primary/50 hover:bg-accent"
                                >
                                    {tech}
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                </section>
            ) : null}

            {/* 社交链接 */}
            <section className="container mx-auto px-6 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mx-auto max-w-2xl"
                >
                    <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        链接
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {settings.github_username ? (
                            <SocialCard
                                href={`https://github.com/${settings.github_username}`}
                                icon={<Code className="size-5" />}
                                title="GitHub"
                                subtitle={`@${settings.github_username}`}
                            />
                        ) : null}
                        {settings.site_url ? (
                            <SocialCard
                                href={settings.site_url}
                                icon={<ExternalLink className="size-5" />}
                                title="网站"
                                subtitle={settings.site_url.replace(/^https?:\/\//, "")}
                            />
                        ) : null}
                    </div>
                </motion.div>
            </section>

            {/* 底部装饰 */}
            <div className="flex flex-1 items-end">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    className="w-full border-t border-edge-hairline py-12 text-center"
                >
                    <p className="font-mono text-sm text-muted-foreground">
                        {settings.footer_text || "built with obsession"}
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

/** 社交链接卡片 */
function SocialCard({
    href,
    icon,
    title,
    subtitle,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-xl border border-edge-hairline bg-background p-5 transition-all hover:border-primary/50 hover:shadow-md"
        >
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-accent">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
            </span>
            <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </a>
    );
}

export const Route = createFileRoute("/about/")({
    head: () => ({
        meta: [{ title: "关于" }],
    }),
    component: AboutPage,
});
