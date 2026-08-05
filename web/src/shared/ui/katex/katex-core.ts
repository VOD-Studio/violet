/**
 * katex-core - KaTeX 渲染核心（编辑器与阅读端共享）
 *
 * 单一职责：导入 katex 单例、注册 mhchem（\ce 化学式 / \pu 物理单位）、
 * 提供物理宏表与统一渲染入口。编辑器扩展配置与阅读端组件都从这里取，
 * 保证「写作时所见」与「发布后所渲染」一致（浏览时渲染决策，见 ADR-0004）。
 *
 * 宏表模拟 LaTeX physics 宏包常用命令；\div 刻意不覆写（与除号冲突），
 * 散度用 \divg。
 */
import katex, { type KatexOptions } from "katex";
import "katex/contrib/mhchem";

/** 物理宏表：physics 宏包常用命令的 KaTeX 宏模拟 + 常用数集缩写 */
export const KATEX_MACROS: Record<string, string> = {
	// 数集
	"\\RR": "\\mathbb{R}",
	"\\ZZ": "\\mathbb{Z}",
	"\\NN": "\\mathbb{N}",
	"\\QQ": "\\mathbb{Q}",
	"\\CC": "\\mathbb{C}",
	// 微分与导数（\dv{f}{x} 双参数；\dd 后接 {x} 自然成组）
	"\\dd": "\\mathop{}\\!\\mathrm{d}",
	"\\dv": "\\frac{\\mathop{}\\!\\mathrm{d}#1}{\\mathop{}\\!\\mathrm{d}#2}",
	"\\pdv": "\\frac{\\partial#1}{\\partial#2}",
	// 狄拉克记号
	"\\bra": "\\langle#1|",
	"\\ket": "|#1\\rangle",
	"\\braket": "\\langle#1|#2\\rangle",
	"\\expval": "\\langle#1\\rangle",
	// 绝对值/范数/向量
	"\\abs": "\\left|#1\\right|",
	"\\norm": "\\left\\|#1\\right\\|",
	"\\vu": "\\hat{#1}",
	// 矢量算子（\div 与除号冲突，散度用 \divg）
	"\\grad": "\\nabla",
	"\\divg": "\\nabla\\cdot",
	"\\curl": "\\nabla\\times",
	// 自动缩放括号（physics \qty(...) 的圆括号形态）
	"\\qty": "\\left(#1\\right)",
};

/** 编辑器扩展用配置：与阅读端同一宏表，渲染错误内嵌展示不中断编辑 */
export const KATEX_OPTIONS: KatexOptions = {
	throwOnError: false,
	strict: false,
	macros: KATEX_MACROS,
};

/**
 * renderKatex - 渲染 LaTeX 为 KaTeX HTML 字符串
 *
 * throwOnError:false：非法公式由 KaTeX 内嵌红色错误标记（katex-error），
 * 阅读端不白屏、编辑端不打断。纯字符串变换，SSR/客户端同构。
 */
export function renderKatex(latex: string, displayMode: boolean): string {
	return katex.renderToString(latex, {
		...KATEX_OPTIONS,
		displayMode,
	});
}
