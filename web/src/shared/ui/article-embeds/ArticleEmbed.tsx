import { AlertCircle } from "lucide-react";
import styles from "./ArticleEmbed.module.css";
import type { ArticleContentContext, ArticleEmbedModule } from "./types";

export interface ArticleEmbedProps {
	/** 种类名，出现在配置无效的提示里。 */
	kind: string;
	/** 已加载的嵌入实现。 */
	module: ArticleEmbedModule;
	/** 围栏块里的原文（JSON）。 */
	source: string;
	context?: ArticleContentContext;
}

/** 把围栏块里的配置交给嵌入实现渲染；JSON 或配置无效时显示可读降级，不中断文章其余部分。 */
export function ArticleEmbed({ kind, module, source, context }: ArticleEmbedProps) {
	let config: unknown = null;
	try {
		config = module.parse(JSON.parse(source));
	} catch {
		config = null;
	}
	if (config === null) {
		return (
			<aside className={styles.invalid} role="note">
				<p>
					<AlertCircle aria-hidden />
					无法解析 {kind} 卡片配置
				</p>
				<pre>{source}</pre>
			</aside>
		);
	}
	const { Component } = module;
	return <Component config={config} context={context} />;
}
