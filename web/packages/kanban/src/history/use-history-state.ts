import { useSyncExternalStore } from "react";
import type { CommandHistory, HistoryState } from "../core/index.ts";

/** 订阅历史的状态：撤销重做是否可用、下一步的名称与最近一次结果。 */
export function useHistoryState(history: CommandHistory): HistoryState {
	return useSyncExternalStore(history.subscribe, history.getState, history.getState);
}
