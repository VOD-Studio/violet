import type { ReactNode } from "react";
import { getComponentStatus } from "../model/guides";
import { GuideTocContent, GuideTocLayout } from "./LibraryGuideToc";

interface ComponentDocProps {
	componentId: string;
	children: ReactNode;
}

/** 组件成熟度读取清单；正文的 h2/h3 自动进入页内目录。 */
export function ComponentDoc({ componentId, children }: ComponentDocProps) {
	const status = getComponentStatus(componentId);

	return (
		<GuideTocLayout>
			<article className="w-full space-y-14 pb-24 font-sans">
				<GuideTocContent>
					<p className="mb-6 text-sm text-muted-foreground">
						当前状态：{status}。{status === "foundation" && "已完成基础契约重建。"}
						{status === "legacy" && "兼容单元，尚未完成基础契约重建。"}
					</p>
					{children}
				</GuideTocContent>
			</article>
		</GuideTocLayout>
	);
}
