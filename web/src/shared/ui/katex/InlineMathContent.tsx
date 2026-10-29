import { AsyncContent } from "@shared/ui/deferred-content/DeferredContent";
import { loadInlineMathFormula } from "./math-formula-loader";

/**
 * 为段落内公式保留稳定的 LaTeX 语义载体，加载与失败期间仍可阅读原文。
 *
 * @remarks 错误反馈也位于同一载体内，批注取文不会混入加载提示或重试按钮；
 * 不按行内节点设置视口观察器，模块与块公式共享。
 */
export function InlineMathContent({ latex }: { latex: string }) {
	return (
		<span data-type="inline-math" data-latex={latex}>
			<AsyncContent
				inline
				load={loadInlineMathFormula}
				componentProps={{ latex }}
				label="公式"
				fallback={latex}
			/>
		</span>
	);
}
