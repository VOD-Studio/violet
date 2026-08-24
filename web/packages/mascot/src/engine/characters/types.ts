import type { EffectMounts } from "../effects/types";
import type { Pose } from "../pose";
import type { FrameContext } from "../types";

/**
 * 形象渲染器接缝:一次性创建本形象全部 SVG 结构,之后把 Pose 逐帧写入。
 *
 * Pose 是各形象共享的语义通道;新形象实现本接口并接入上层工厂即可,
 * 不复用 ticker、特效与姿态控制。
 */
export interface CharacterRenderer {
	/** SVG 根节点:宿主挂载与事件绑定目标 */
	readonly root: SVGSVGElement;
	/** 特效挂载点 */
	readonly mounts: EffectMounts;
	/** 把一帧姿态写入 rig;frame 由门面复用,不得持有引用 */
	render(pose: Pose, frame: FrameContext): void;
	/** 移除 SVG 根节点 */
	destroy(): void;
}
