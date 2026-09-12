import { useEffect, useReducer, useState } from "react";
import { buildRuntimeLogStreamURL } from "../api/client";
import type { RuntimeLogEntry, RuntimeLogFilter } from "../model/types";

const MAX_LIVE_ENTRIES = 500;
const RECONNECT_DELAY_MS = 1000;
const HEARTBEAT_TIMEOUT_MS = 25_000;

export type RuntimeLogConnectionState =
	| "idle"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "revoked"
	| "error";

interface StreamGap {
	oldest_cursor: string;
	newest_cursor: string;
	resume_cursor: string;
}

interface StreamState {
	entries: RuntimeLogEntry[];
	evicted: number;
	gap: StreamGap | null;
}

type StreamAction =
	| { type: "reset" }
	| { type: "append"; entries: RuntimeLogEntry[] }
	| { type: "gap"; gap: StreamGap };

const initialState: StreamState = {
	entries: [],
	evicted: 0,
	gap: null,
};

const compareCursor = (left: string, right: string) => {
	const a = BigInt(left);
	const b = BigInt(right);
	return a < b ? -1 : a > b ? 1 : 0;
};

const streamReducer = (state: StreamState, action: StreamAction): StreamState => {
	if (action.type === "reset") return initialState;
	if (action.type === "gap") {
		return { ...state, gap: action.gap };
	}

	const byID = new Map(state.entries.map((entry) => [entry.id, entry]));
	for (const entry of action.entries) byID.set(entry.id, entry);
	const merged = [...byID.values()].sort((left, right) => compareCursor(left.id, right.id));
	const evicted = Math.max(0, merged.length - MAX_LIVE_ENTRIES);
	return {
		entries: evicted > 0 ? merged.slice(evicted) : merged,
		evicted: state.evicted + evicted,
		gap: state.gap,
	};
};

interface RuntimeLogStreamResult extends StreamState {
	connection: RuntimeLogConnectionState;
	error: string | null;
}

/** 从历史快照游标接续实时日志；筛选变化会关闭旧连接并建立新边界。 */
export const useRuntimeLogStream = (
	filters: RuntimeLogFilter,
	after: string,
	enabled: boolean,
): RuntimeLogStreamResult => {
	const [state, dispatch] = useReducer(streamReducer, initialState);
	const [connection, setConnection] = useState<RuntimeLogConnectionState>("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		dispatch({ type: "reset" });
		setError(null);
		if (!enabled) {
			setConnection("idle");
			return;
		}

		let source: EventSource | null = null;
		let heartbeatTimer: number | undefined;
		let reconnectTimer: number | undefined;
		let resumeCursor = after;
		let stopped = false;
		let canReconnect = true;

		const clearHeartbeat = () => {
			window.clearTimeout(heartbeatTimer);
			heartbeatTimer = undefined;
		};
		const closeSource = () => {
			if (!source) return;
			source.onerror = null;
			source.close();
			source = null;
		};
		const rememberCursor = (event: MessageEvent<string>) => {
			if (event.lastEventId) resumeCursor = event.lastEventId;
		};
		const armHeartbeat = () => {
			clearHeartbeat();
			heartbeatTimer = window.setTimeout(() => {
				scheduleReconnect("实时连接长时间未响应，正在从上次游标恢复");
			}, HEARTBEAT_TIMEOUT_MS);
		};
		const acceptEvent = (event: MessageEvent<string>) => {
			rememberCursor(event);
			setConnection("connected");
			setError(null);
			armHeartbeat();
		};
		const stopWithError = (message: string) => {
			canReconnect = false;
			clearHeartbeat();
			closeSource();
			setConnection("error");
			setError(message);
		};
		const scheduleReconnect = (message: string) => {
			if (stopped || !canReconnect || reconnectTimer !== undefined) return;
			clearHeartbeat();
			closeSource();
			setConnection("reconnecting");
			setError(message);
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = undefined;
				connect();
			}, RECONNECT_DELAY_MS);
		};
		const connect = () => {
			if (stopped || !canReconnect) return;
			const nextSource = new EventSource(buildRuntimeLogStreamURL(filters, resumeCursor), {
				withCredentials: true,
			});
			source = nextSource;
			nextSource.onopen = () => {
				if (source !== nextSource) return;
				setConnection("connected");
				setError(null);
				armHeartbeat();
			};
			nextSource.onerror = () => {
				if (source !== nextSource) return;
				scheduleReconnect("实时连接中断，正在从上次游标恢复");
			};
			nextSource.addEventListener("ready", (rawEvent) => {
				if (source !== nextSource) return;
				acceptEvent(rawEvent as MessageEvent<string>);
			});
			nextSource.addEventListener("checkpoint", (rawEvent) => {
				if (source !== nextSource) return;
				acceptEvent(rawEvent as MessageEvent<string>);
			});
			nextSource.addEventListener("heartbeat", (rawEvent) => {
				if (source !== nextSource) return;
				acceptEvent(rawEvent as MessageEvent<string>);
			});
			nextSource.addEventListener("logs", (rawEvent) => {
				if (source !== nextSource) return;
				try {
					const event = rawEvent as MessageEvent<string>;
					const payload = JSON.parse(event.data) as { items: RuntimeLogEntry[] };
					dispatch({ type: "append", entries: payload.items });
					acceptEvent(event);
				} catch {
					stopWithError("实时日志响应格式无效");
				}
			});
			nextSource.addEventListener("gap", (rawEvent) => {
				if (source !== nextSource) return;
				try {
					const event = rawEvent as MessageEvent<string>;
					const gap = JSON.parse(event.data) as StreamGap;
					dispatch({ type: "gap", gap });
					acceptEvent(event);
				} catch {
					stopWithError("实时日志缺口信息无效");
				}
			});
			nextSource.addEventListener("stream-error", (rawEvent) => {
				if (source !== nextSource) return;
				rememberCursor(rawEvent as MessageEvent<string>);
				scheduleReconnect("服务端读取中断，正在从上次游标恢复");
			});
			nextSource.addEventListener("access-revoked", () => {
				if (source !== nextSource) return;
				canReconnect = false;
				clearHeartbeat();
				closeSource();
				setConnection("revoked");
				setError("会话或运行日志权限已失效");
			});
		};

		setConnection("connecting");
		connect();
		return () => {
			stopped = true;
			clearHeartbeat();
			window.clearTimeout(reconnectTimer);
			closeSource();
		};
	}, [after, enabled, filters]);

	return { ...state, connection, error };
};
