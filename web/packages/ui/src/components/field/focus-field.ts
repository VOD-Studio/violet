/**
 * 把焦点移到 `id` 对应的控件，让汇总条目与提交失败时能直达第一个错误。
 *
 * @returns 找到元素并聚焦返回 `true`，页面上没有这个 id 返回 `false`。
 */
export function focusField(id: string): boolean {
	const element = document.getElementById(id);
	if (!element) return false;
	element.focus({ preventScroll: false });
	return true;
}
