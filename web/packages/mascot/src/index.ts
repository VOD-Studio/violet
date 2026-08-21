/**
 * 堇喵(Cat-Mochi)引擎:纯 TS SVG 渲染与物理状态机。
 *
 * "." 入口导出引擎与表情目录;"./react" 入口导出 MascotStage React 宿主。
 */

export { DEFAULT_EMOTION_BY_STATE, resolveEmotionId } from "./agent-state";
export { PALETTE } from "./engine/characters/catMochi/palette";
export { DEFAULT_EMOTION_ID, EMOTION_MAP, EMOTIONS } from "./engine/emotions";
export type { MascotEffectConfig, MascotOptions } from "./engine/mascot";
export { Mascot } from "./engine/mascot";
export type * from "./engine/types";
export type { AIMessage, AIMessageResult } from "./protocol";
