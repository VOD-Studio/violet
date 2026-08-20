import type { AgentState, AgentStatusMessage } from "@violet/agent-status";
import { DEFAULT_EMOTION_ID } from "./engine/emotions";

/**
 * 各语义状态的默认表情(violet mascot 表情 ID);
 * 消费端可用自有映射表整体覆盖(见 {@link resolveEmotionId})。
 */
export const DEFAULT_EMOTION_BY_STATE: Record<AgentState, string> = {
	thinking: "25",
	executing: "34",
	error: "27",
	done: "28",
	idle: DEFAULT_EMOTION_ID,
};

/**
 * 解析消息最终表情:emotionId 覆盖逃生舱优先,state 默认映射兜底。
 *
 * @param msg - 待解析的 agent 状态消息
 * @param emotionByState - 消费端自有映射表,缺省用 violet mascot 默认映射
 * @returns 表情 ID
 */
export function resolveEmotionId(
	msg: AgentStatusMessage,
	emotionByState: Record<AgentState, string> = DEFAULT_EMOTION_BY_STATE,
): string {
	return msg.emotionId ?? emotionByState[msg.state];
}
