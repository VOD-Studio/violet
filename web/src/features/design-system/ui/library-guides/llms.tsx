import { GuideLink, GuideSection } from "./GuideParts";

/** LLMs.txt 章节：机器可读的文档发现入口。 */
export default function LlmsGuide() {
	return (
		<GuideSection title="机器可读索引">
			<p>
				<a
					className="font-medium text-primary underline underline-offset-4"
					href="/llms.txt"
				>
					打开 /llms.txt
				</a>{" "}
				可获取可直接读取的 Markdown 文档清单，包含入门、设计规范和已成文组件页；无需执行
				JavaScript。
			</p>
			<p>
				llms.txt 是文档发现入口，不包含组件源码或实时 props 表。使用组件前查看{" "}
				<GuideLink to="/design-system/specimens">组件用法页</GuideLink>
				；开发库本身时再核对 <code>web/packages/ui/src/index.ts</code> 的真实导出。
			</p>
		</GuideSection>
	);
}
