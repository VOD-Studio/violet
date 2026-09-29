import type { ReactNode } from "react";
import { GuideTocContent, GuideTocLayout } from "./LibraryGuideToc";

/**
 * 组件文档页骨架：与其他章节共用右侧页内目录与版心规则。
 *
 * @param children - 文档正文；章节标题（h2/h3）会被提取进页内目录并挂锚点
 */
export function SpecimenDoc({ children }: { children: ReactNode }) {
	return (
		<GuideTocLayout>
			<article className="w-full space-y-14 pb-24 font-sans">
				<GuideTocContent>{children}</GuideTocContent>
			</article>
		</GuideTocLayout>
	);
}
