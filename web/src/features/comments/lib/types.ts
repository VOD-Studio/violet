/**
 * comments 模块 lib 共享类型（前端内部 camelCase 形态）。
 *
 * 与 application 层 AnchorInput（snake_case 外部契约）区别：
 *   - AnchorInput 是请求体 JSON 形态，序列化时用；
 *   - Anchor 是前端内部计算/传递形态，命名跟 TS 惯例。
 *   两者字段一一对应，转换在 API client 层完成。
 */
export interface Anchor {
	/** 块标识符（块纯文本 SHA-256 前 8 位） */
	blockId: string;
	/** 选区起始偏移（块内字符位，0-based） */
	startOffset: number;
	/** 选区结束偏移（块内字符位，exclusive） */
	endOffset: number;
	/** 选中原文（fuzzy 重定位的锚） */
	selectedText: string;
	/** 块内容快照（创建时的 SHA-256 前 8 位，漂移检测用） */
	blockTextHash: string;
}
