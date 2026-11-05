import { useState } from "react";

/**
 * 浮层的挂载容器：把 Portal 收进展品舞台，浮层才会随检视台的明暗、季节与减弱动态一起变化，
 * 展柜也能裁出它的占地。ref 回调挂在舞台根元素上，容器元素传给内容的 `container`。
 */
export function useStageContainer() {
	const [container, setContainer] = useState<HTMLElement | null>(null);
	return { ref: setContainer, container };
}
