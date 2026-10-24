import { createAsyncLoader } from "@shared/lib/create-async-loader";

const loadMathFormulaModule = createAsyncLoader(() => import("./MathFormula"));

/**
 * 加载块公式组件，与行内公式共用同一模块请求。
 *
 * @returns 供 DeferredContent 使用的组件模块。
 * @remarks 函数本身不启动请求；调用方在近视口后调用。成功结果复用，失败清除 Promise 以允许重试。
 */
export function loadBlockMathFormula() {
	return loadMathFormulaModule().then((module) => ({ default: module.BlockMathFormula }));
}

/**
 * 加载行内公式组件，不为每个行内节点设置视口观察器。
 *
 * @remarks 调用方使用行内 AsyncContent 隔离失败，加载期间保留 LaTeX 原文；
 * 与块公式共享成功模块，失败后可重新加载。
 */
export function loadInlineMathFormula() {
	return loadMathFormulaModule().then((module) => ({ default: module.InlineMathFormula }));
}
