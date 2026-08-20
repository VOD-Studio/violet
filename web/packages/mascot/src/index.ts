/**
 * 堇喵(Cat-Mochi)引擎:纯 TS SVG 渲染与物理状态机。
 *
 * "." 入口导出引擎与表情目录;"./react" 入口导出 MascotStage React 宿主。
 */

export { DEFAULT_EMOTION_BY_STATE, resolveEmotionId } from "./agent-state";
export * from "./engine/expressions";
export type { MascotOptions } from "./engine/mascot";
export { Mascot } from "./engine/mascot";
export type { AIMessage, AIMessageResult } from "./protocol";
