import type { AgentStatusMessage } from "./index";

/**
 * Agent 状态传输通道 SPI:消息从汇聚端到消费端的可插拔抽象。
 *
 * subscribe 必选(消费端核心);dispatch 可选——只读通道
 * (如浏览器端 SSE 消费)无派发能力。同一 SPI 下实现 SSE/
 * CustomEvent/postMessage 等通道,协议与适配器零改动。
 */
export interface AgentTransport {
	/** 订阅状态消息流;返回退订函数 */
	subscribe(listener: (msg: AgentStatusMessage) => void): () => void;
	/** 派发状态消息到通道对端;只读通道不实现 */
	dispatch?(msg: AgentStatusMessage): void;
}
