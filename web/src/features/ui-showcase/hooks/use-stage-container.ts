import { useState } from "react";

/**
 * 浮层的挂载点：把 Portal 收进展品舞台或展品所在的外观作用域，浮层才会随检视台的明暗、季节与减弱动态一起变化。
 * ref 回调挂在舞台根元素上。
 *
 * @returns container 为舞台本身，弹出层、菜单与常开陈列挂在这里，展柜能裁出它的占地；
 * host 为展厅或检视台的外观作用域，由交互打开的对话框、确认框与命令面板挂在这里，铺满整个视口
 */
export function useStageContainer() {
	const [container, setContainer] = useState<HTMLElement | null>(null);
	const host = container?.closest<HTMLElement>("[data-showcase-scope]") ?? null;
	return { ref: setContainer, container, host };
}
