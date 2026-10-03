import { Link } from "@tanstack/react-router";
import {
	COMPONENT_DOCS,
	FOUNDATION_COMPONENTS,
	getComponentStatus,
	LEGACY_COMPONENTS,
} from "../model/guides";
import { DocHeader } from "./DocHeader";

export function ComponentsIndex() {
	return (
		<article className="mx-auto w-full max-w-4xl pb-16">
			<DocHeader
				title="组件"
				scope={`@violet/ui 当前有 ${FOUNDATION_COMPONENTS.length} 个 foundation 单元和 ${LEGACY_COMPONENTS.length} 个 legacy 单元。以下页面提供已有组件的真实预览、同源代码与使用契约。`}
			/>
			<ul className="grid gap-3 sm:grid-cols-2">
				{COMPONENT_DOCS.map((component) => (
					<li key={component.id}>
						<Link
							to={component.to}
							className="block h-full rounded-lg border border-border p-5 motion-safe:transition-colors hover:bg-accent/40"
						>
							<div className="flex items-center justify-between gap-3">
								<span className="font-mono text-base font-semibold text-foreground">
									{component.title}
								</span>
								<span className="text-xs text-muted-foreground">
									{getComponentStatus(component.id)}
								</span>
							</div>
							<p className="mt-2 text-sm text-muted-foreground">
								{component.description}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</article>
	);
}
