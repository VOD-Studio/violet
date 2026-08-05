import type { SiteSettings } from "@features/settings/model/types";
import type { AboutSection } from "../model/about-config";

/** 区块组件统一入参：自身的 section 配置 + 全局站点设置 */
export interface AboutSectionProps {
	/** 本区块的配置（params 在此取） */
	section: AboutSection;
	/** 全站点设置（bio/github_username 等公共字段） */
	settings: SiteSettings;
}

/**
 * AboutSectionPlaceholder - 区块占位组件
 *
 * Issue-0002 骨架阶段，未实现的区块用此占位渲染「区块: {id}」，
 * 后续 Issue-0003/0004/0005/0006/0007 逐个用真实区块组件替换注册表条目。
 */
export function AboutSectionPlaceholder({ section }: AboutSectionProps) {
	return (
		<section className="container mx-auto px-6 py-20">
			<div className="mx-auto max-w-2xl rounded-lg border border-dashed border-edge-hairline p-8 text-center">
				<p className="font-mono text-sm text-muted-foreground">区块占位：{section.id}</p>
			</div>
		</section>
	);
}
