/**
 * Agent 状态协议 v2:语义状态消息 + TTL 状态机。
 *
 * 零 UI 依赖,node(适配器/汇聚端)与浏览器(消费端)两侧均可运行。
 * 语义层与表现层解耦:agent 只发 state,消费端按默认映射呈现,
 * emotionId 作为覆盖逃生舱越过映射。完整设计见 PRD-0018。
 */

/** 语义状态:agent 工作状态的机器可读枚举 */
export type AgentState = "thinking" | "executing" | "error" | "done" | "idle";

/** 全部合法语义状态,运行时判别用 */
export const AGENT_STATES: readonly AgentState[] = [
	"thinking",
	"executing",
	"error",
	"done",
	"idle",
] as const;

/** 消息类型标识:命名空间化,CustomEvent/postMessage/SSE 等通道共用 */
export const AGENT_STATUS_MESSAGE_TYPE = "violet-mascot:agent-status";

export interface AgentStatusMessage {
	/** wire 判别标识,恒为 {@link AGENT_STATUS_MESSAGE_TYPE} */
	type: typeof AGENT_STATUS_MESSAGE_TYPE;
	/** 来源标识("codex"/"claude-code"/自定义);seq 去重按 agent 分流 */
	agent: string;
	/** 语义层主通道:消费端按 state 走默认映射 */
	state: AgentState;
	/** 事件序列号:适配器进程内自增;同 agent 下非单调递增的消息被丢弃 */
	seq: number;
	/** 毫秒时间戳;距当前时间超过寿命的消息视为过期被丢弃 */
	ts: number;
	/** 状态详情(正在跑测试/写文件),供 UI 呈现 */
	detail?: string;
	/** 覆盖逃生舱:越过 state 默认映射直接指定消费端表现(如表情 ID) */
	emotionId?: string;
	/** 对白/摘要文本;缺省由消费端取该表现默认描述 */
	tips?: string;
	/**
	 * 寿命毫秒数:到期自动回 idle。
	 * 0 = 不过期;缺省按 state 取默认 TTL。
	 */
	ttlMs?: number;
}

/** v1 注入面:仅直接指定表现 + 可选文本,无语义状态与寿命语义 */
export interface AgentEmotionInput {
	emotionId: string;
	tips?: string;
}

/**
 * 各语义状态的默认寿命:done/error 播完庆祝/沮且回 idle;
 * thinking/executing 长任务防呆;idle 永不过期。
 */
export const DEFAULT_STATE_TTL_MS: Record<AgentState, number> = {
	thinking: 120_000,
	executing: 120_000,
	done: 6_000,
	error: 6_000,
	idle: 0,
};

/**
 * 定时器句柄:浏览器 number、Node Timeout。
 * 由注入的 setTimer/clearTimer 成对产生与解释,store 不解释其内容。
 */
export type AgentTimerHandle = ReturnType<typeof setTimeout>;

/**
 * 构造 v2 消息:自动填 type 判别标识。
 *
 * @param fields - 除 type 外的全部字段
 */
export function statusMessage(fields: Omit<AgentStatusMessage, "type">): AgentStatusMessage {
	return { type: AGENT_STATUS_MESSAGE_TYPE, ...fields };
}

/**
 * 运行时判别 wire 数据(通道层收到的 JSON)是否为合法 v2 消息。
 *
 * 校验必填字段(agent 非空/state 枚举/seq 与 ts 为有限数);
 * 可选字段不校验,由消费端按需容错。
 */
export function isAgentStatusMessage(v: unknown): v is AgentStatusMessage {
	if (typeof v !== "object" || v === null) return false;
	const m = v as Record<string, unknown>;
	return (
		m.type === AGENT_STATUS_MESSAGE_TYPE &&
		typeof m.agent === "string" &&
		m.agent.length > 0 &&
		AGENT_STATES.includes(m.state as AgentState) &&
		Number.isFinite(m.seq) &&
		Number.isFinite(m.ts)
	);
}

/** {@link AgentStatusStore.accept} 的结果:生效或被丢弃(附原因) */
export type AcceptResult =
	| { applied: true; message: AgentStatusMessage }
	| { applied: false; reason: "stale-seq" | "expired-ts" };

export interface AgentStatusStoreOptions {
	/** 时钟注入(测试替身);缺省 Date.now */
	now?: () => number;
	/** 定时器注入(测试替身);缺省 setTimeout */
	setTimer?: (fn: () => void, ms: number) => unknown;
	/** 清除定时器注入(测试替身);缺省 clearTimeout */
	clearTimer?: (handle: unknown) => void;
	/**
	 * 状态生效回调:accept/inject 与 TTL 到期回 idle 时同步触发,
	 * 消费端(如 React setState)经此驱动 UI。
	 */
	onStateChange?: (msg: AgentStatusMessage) => void;
	/** 覆盖部分状态的默认 TTL;显式 ttlMs 仍最优先 */
	ttlByState?: Partial<Record<AgentState, number>>;
}

/**
 * 状态机消费端:per-agent seq 去重 + ts 过期判定 + TTL 到期自动回 idle。
 *
 * accept 消费 v2 消息流(传输通道来的);inject 消费 v1 兼容输入
 * (内部独立 seq 轴,不与任何 agent 的外部 seq 冲突)。
 * TTL 到期派发的合成 idle 不占用外部 seq 轴(复用触发消息的 seq)。
 */
export class AgentStatusStore {
	private readonly now: () => number;
	private readonly setTimer: (fn: () => void, ms: number) => unknown;
	private readonly clearTimer: (handle: unknown) => void;
	private readonly onStateChange?: (msg: AgentStatusMessage) => void;
	private readonly ttlByState?: Partial<Record<AgentState, number>>;
	private lastSeqByAgent = new Map<string, number>();
	private injectSeq = 0;
	private timerHandle: unknown = null;
	private currentMsg: AgentStatusMessage;

	constructor(options: AgentStatusStoreOptions = {}) {
		this.now = options.now ?? (() => Date.now());
		this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
		this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as AgentTimerHandle));
		this.onStateChange = options.onStateChange;
		this.ttlByState = options.ttlByState;
		this.currentMsg = statusMessage({ agent: "system", state: "idle", seq: 0, ts: 0 });
	}

	/** 当前生效状态;构造后为 system idle */
	current(): AgentStatusMessage {
		return this.currentMsg;
	}

	/**
	 * 消费一条 v2 消息:seq 单调性检查(同 agent)→ ts 过期判定 → 应用。
	 *
	 * @returns 生效消息,或丢弃原因(stale-seq 重放/乱序;expired-ts 已超寿命)
	 */
	accept(msg: AgentStatusMessage): AcceptResult {
		const last = this.lastSeqByAgent.get(msg.agent);
		if (last !== undefined && msg.seq <= last) {
			return { applied: false, reason: "stale-seq" };
		}
		const ttl = this.effectiveTtl(msg);
		if (ttl > 0 && this.now() - msg.ts > ttl) {
			return { applied: false, reason: "expired-ts" };
		}
		this.lastSeqByAgent.set(msg.agent, msg.seq);
		this.apply(msg);
		return { applied: true, message: msg };
	}

	/**
	 * v1 兼容注入:仅指定表现(如表情 ID)+ 可选文本。
	 *
	 * 合成 executing 仅满足协议必填(表现必走 emotionId,不经 state 映射);
	 * ttl 0 保持 v1 行为——一直显示到下一条消息,不自动回 idle。
	 *
	 * @param agent - 来源标识,缺省 "manual";独立 seq 轴,可多次注入互不阻塞
	 * @returns 合成后实际生效的 v2 消息
	 */
	inject(input: AgentEmotionInput, agent = "manual"): AgentStatusMessage {
		this.injectSeq += 1;
		const msg = statusMessage({
			agent,
			state: "executing",
			seq: this.injectSeq,
			ts: this.now(),
			emotionId: input.emotionId,
			...(input.tips !== undefined && { tips: input.tips }),
			ttlMs: 0,
		});
		this.lastSeqByAgent.set(agent, msg.seq);
		this.apply(msg);
		return msg;
	}

	/** 释放 TTL 定时器;dispose 后 store 不再自动回 idle */
	dispose(): void {
		this.clearTimerNow();
	}

	private apply(msg: AgentStatusMessage): void {
		this.clearTimerNow();
		this.currentMsg = msg;
		this.onStateChange?.(msg);
		const ttl = this.effectiveTtl(msg);
		if (ttl > 0) {
			this.timerHandle = this.setTimer(() => {
				this.apply(
					statusMessage({
						agent: msg.agent,
						state: "idle",
						seq: msg.seq,
						ts: this.now(),
						...(msg.detail !== undefined && { detail: msg.detail }),
					}),
				);
			}, ttl);
		}
	}

	private effectiveTtl(msg: AgentStatusMessage): number {
		if (msg.ttlMs !== undefined) return msg.ttlMs;
		return this.ttlByState?.[msg.state] ?? DEFAULT_STATE_TTL_MS[msg.state];
	}

	private clearTimerNow(): void {
		if (this.timerHandle !== null) {
			this.clearTimer(this.timerHandle);
			this.timerHandle = null;
		}
	}
}
