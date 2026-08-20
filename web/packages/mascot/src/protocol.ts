/**
 * v1 AI 消息协议:驱动吉祥物的最小消息形状。
 *
 * JSON Schema 常量与三通道接入示例在 T2 协议公开化时补充(PRD-0017)。
 */

/**
 * AI 消息输入。
 *
 * emotionId 缺省或未知时回退待机,不报错。
 * 与 @violet/agent-status 的 AgentEmotionInput 字段同形,但 emotionId
 * 在协议入口可选(缺省走回退),注入面必填(直接指定表现)。
 */
export interface AIMessage {
	/** 表情 ID;未知值回退待机 */
	emotionId?: string;
	/** 对白气泡台词;缺省用该表情默认描述 */
	tips?: string;
}

/** AI 消息解析结果:回退后的最终 emotionId + 透传的台词 */
export type AIMessageResult = { emotionId: string; tips?: string };
