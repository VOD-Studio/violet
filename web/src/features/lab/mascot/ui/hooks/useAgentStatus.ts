import { type AgentStatusMessage, AgentStatusStore } from "@violet/agent-status";
import { createSseTransport } from "@violet/agent-status/transport/sse";
import { useEffect, useState } from "react";

const AGENT_STATUS_ENDPOINT = "/api/dev/agent-status";

/**
 * 订阅 agent 状态流(dev SSE):协议消息经 store 去重/过期/TTL 后的当前状态。
 *
 * @returns 当前 agent 消息;无 agent 流量时为 null(不接管舞台表情)
 */
export function useAgentStatus(): AgentStatusMessage | null {
	const [msg, setMsg] = useState<AgentStatusMessage | null>(null);

	useEffect(() => {
		// system 合成初始 idle 不接管——仅真实外部 agent 消息(含 TTL 到期回落的
		// 同名 idle)驱动表情,避免页面打开即覆盖用户固定表情
		const store = new AgentStatusStore({
			onStateChange: (m) => {
				if (m.agent !== "system") setMsg(m);
			},
		});
		const transport = createSseTransport({ url: AGENT_STATUS_ENDPOINT });
		const off = transport.subscribe((m) => store.accept(m));
		return () => {
			off();
			store.dispose();
		};
	}, []);

	return msg;
}
