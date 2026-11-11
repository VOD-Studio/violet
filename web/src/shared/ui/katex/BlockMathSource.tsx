/** 块公式容器的外边距与横向溢出，排版前后一致。 */
export const BLOCK_MATH_CLASS = "my-6 overflow-x-auto";

/** 尚未排版的 LaTeX 原文：等宽、次级色、居中，一眼能与正文区分。 */
export const BLOCK_MATH_SOURCE_CLASS = `${BLOCK_MATH_CLASS} text-center font-mono text-sm whitespace-pre-wrap text-muted-foreground`;

/**
 * 块公式排版前的可读降级：服务端、未启用脚本与排版模块到位之前显示 LaTeX 原文。
 *
 * @remarks 不依赖 KaTeX 模块；与排版后的容器同一语义载体，批注取文口径不变。
 */
export function BlockMathSource({ latex }: { latex: string }) {
	return (
		<div className={BLOCK_MATH_SOURCE_CLASS} data-type="block-math" data-latex={latex}>
			{latex}
		</div>
	);
}
