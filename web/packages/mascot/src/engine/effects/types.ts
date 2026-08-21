/**
 * 特效接缝:挂载点由形象 renderer 提供,特效类只经由挂载点操作 DOM。
 */

/** 特效挂载点:back 画在身体之下,front 画在身体之上,defs 放渐变定义。 */
export interface EffectMounts {
	back: SVGGElement;
	front: SVGGElement;
	defs: SVGElement;
}

/** 特效最小生命周期:clear 移除本特效全部 DOM 与内部状态。 */
export interface Effect {
	clear(): void;
}
/** 可由舞台按钮触发并由统一 ticker 推进的独立特效。 */
export interface StageEffect extends Effect {
	trigger(): void;
	step(dt: number): void;
}
