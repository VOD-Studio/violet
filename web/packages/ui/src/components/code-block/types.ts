import type { ComponentProps } from "react";

/** 执行许可由宿主读取；读取失败时必须提供可用的重试动作。 */
export type CodeBlockAvailability =
	| { status: "ready" | "loading" | "disabled" | "language-disabled" }
	| { status: "error"; message: string; onRetry: () => void };

/** 保留流的原始换行与到达顺序，不在每个分片之间补换行。 */
export interface CodeBlockOutputChunk {
	kind: "stdout" | "stderr" | "info";
	text: string;
}

/** 完成态与失败态的结果；null 退出码表示执行服务没有提供退出码。 */
export type CodeBlockRunResult =
	| { status: "success" | "error"; exitCode: number | null; durationMs: number }
	| { status: "timeout" | "oom_killed" }
	| { status: "failed"; message: string };

/** 网络请求、许可与输出由宿主持有，组件只提交当前编辑内容并呈现执行状态。 */
export interface CodeBlockRunConfig {
	availability: CodeBlockAvailability;
	running: boolean;
	onRun: (code: string) => void;
	output: readonly CodeBlockOutputChunk[];
	result?: CodeBlockRunResult;
}

export interface CodeBlockOutputProps extends Omit<ComponentProps<"div">, "children"> {
	output: readonly CodeBlockOutputChunk[];
	running: boolean;
	result?: CodeBlockRunResult;
}
/** 原生属性、className 与 ref 属于 figure；提供 run 时允许本页内编辑，不保存到服务端。 */
export interface CodeBlockProps extends Omit<ComponentProps<"figure">, "children"> {
	code: string;
	/** @default "text" */
	language?: string;
	filename?: string;
	/** 从 1 开始的作者标行。 */
	highlightedLines?: readonly number[];
	/**
	 * 只读形态的折叠阈值；0 表示不折叠。
	 * @default 12
	 */
	collapseLines?: number;
	run?: CodeBlockRunConfig;
	/** 宿主可将受控值连接到本机偏好；省略时由组件维护。 */
	vimEnabled?: boolean;
	/** @default true */
	defaultVimEnabled?: boolean;
	onVimEnabledChange?: (enabled: boolean) => void;
}
