import { type AgentStatusMessage, isAgentStatusMessage } from "../index";
import type { AgentTransport } from "../transport";

/**
 * EventSource 最小消费面(浏览器全局的结构子集,便于测试注入 fake)。
 */
export interface EventSourceLike {
	onmessage: ((ev: { data: string }) => void) | null;
	onerror: ((ev: unknown) => void) | null;
	close(): void;
}

export interface SseTransportOptions {
	/** SSE endpoint 地址(如 "/api/dev/agent-status") */
	url: string;
	/** EventSource 构造器注入(测试替身);缺省用浏览器全局 EventSource */
	eventSource?: new (
		url: string,
	) => EventSourceLike;
}

/**
 * SSE 通道:订阅 endpoint 的 JSON 消息流,判别合法 v2 消息后分发给订阅者。
 *
 * 去重与过期判定不在本层(EventSource 原生自动重连,重连后服务端会重推
 * 当前快照)——交由 AgentStatusStore 的 seq/ts 机制处理。
 */
export function createSseTransport(options: SseTransportOptions): AgentTransport {
	const ES = options.eventSource ?? EventSource;
	const listeners = new Set<(msg: AgentStatusMessage) => void>();
	const source = new ES(options.url);
	source.onmessage = (ev: { data: string }) => {
		try {
			const parsed: unknown = JSON.parse(ev.data);
			if (isAgentStatusMessage(parsed)) {
				for (const listener of listeners) listener(parsed);
			}
		} catch {
			// 非 JSON data 静默丢弃(SSE 注释行不进 onmessage,这里防御半包/脏数据)
		}
	};
	return {
		subscribe(listener: (msg: AgentStatusMessage) => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) {
					source.onmessage = null;
					source.onerror = null;
					source.close();
				}
			};
		},
	};
}

/** SSE data 行序列化(汇聚端写流用),JSON 形态与 isAgentStatusMessage 判别同源 */
export function encodeSseData(msg: AgentStatusMessage): string {
	return JSON.stringify(msg);
}
