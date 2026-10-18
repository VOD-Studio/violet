import type { Point } from "../../core/index.ts";

/** 控制器向看板下达拖拽指令的入口，由看板实现。 */
export interface DragHost {
	/** 看板根节点，控制器在其上监听输入。 */
	readonly root: HTMLElement;
	/** 事件目标所属的可拖拽卡片 id；目标不在卡片内或该卡片不可拖拽时为 null。 */
	cardIdFor(target: EventTarget | null): string | null;
	/** 开始拖拽。`point` 是按下时的 client 坐标，用来保持抓取位置不跳变。 */
	start(cardId: string, point: Point): void;
	/** 指针移动到新的 client 坐标。 */
	move(point: Point): void;
	/** 放下：看板按当前落点提交移动，没有有效落点时卡片回到原位。 */
	drop(): void;
	/** 取消：卡片回到原位。 */
	cancel(): void;
}

/**
 * 拖拽控制器：把输入转换成对看板的拖拽指令。默认实现是 `createPointerController`。
 */
export interface DragController {
	/**
	 * 看板挂载后调用。
	 *
	 * @returns 清理函数，看板卸载或控制器变化时调用
	 */
	attach(host: DragHost): () => void;
}
