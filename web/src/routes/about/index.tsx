import { resolveSectionOrder } from "@features/about/model/about-config";
import { ABOUT_SECTION_IDS, resolveSectionComponent } from "@features/about/ui/section-registry";
import { useSettings } from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";

/**
 * /about - 关于页
 *
 * 数据来自 useSettings（已全局预取）。
 *
 * 渲染模式（单套逻辑，无「默认/配置」双轨）：
 * - about_config 为空 → 全部区块默认 enabled，按注册表顺序渲染（出厂全显）。
 * - about_config 非空 → 解析 sections，按 order 排序、enabled 过滤，用区块注册表渲染。
 *
 * 所有区块均为真实组件；未知 id（历史配置残留）不渲染，避免占位框。
 */
function AboutPage() {
    const { data: settings, isLoading } = useSettings();

    if (isLoading || !settings) {
        return null;
    }
    const orderedIds = resolveSectionOrder(settings.about_config);
    // 配置为空 → 默认全部区块 enabled，按注册表顺序渲染
    const ids = orderedIds.length > 0 ? orderedIds : [...ABOUT_SECTION_IDS];

    return (
        <div className="flex flex-col">
            {ids.map((id) => {
                const Component = resolveSectionComponent(id);
                if (!Component) return null;
                return <Component key={id} section={{ id, enabled: true }} settings={settings} />;
            })}

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

export const Route = createFileRoute("/about/")({
    head: () => ({
        meta: [{ title: "关于" }],
    }),
    component: AboutPage,
});
