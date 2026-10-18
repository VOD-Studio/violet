/** 一步可撤销的操作：携带正向与反向两个动作，由使用方自己执行并持久化。 */
export interface HistoryCommand {
	/** 供按钮提示与播报使用的名称。 */
	label?: string;
	/** 撤销：执行反向操作。返回 Promise 表示持久化，被拒绝即这一步作废。 */
	undo(): void | Promise<void>;
	/** 重做：重新执行正向操作，失败语义同 `undo`。 */
	redo(): void | Promise<void>;
}

/** 最近一次撤销或重做的结果。 */
export interface HistoryOutcome {
	kind: "undo" | "redo";
	ok: boolean;
	label?: string;
	/** 每次结果都会递增，使相同的结果也能被观察到。 */
	seq: number;
}

/** 历史的当前状态，状态没有变化时是同一个引用。 */
export interface HistoryState {
	/** 有可撤销的步骤，且没有撤销或重做正在进行。 */
	canUndo: boolean;
	/** 有可重做的步骤，且没有撤销或重做正在进行。 */
	canRedo: boolean;
	/** 撤销或重做正在进行。 */
	busy: boolean;
	undoLabel?: string;
	redoLabel?: string;
	last?: HistoryOutcome;
}

/** `undo` 与 `redo` 的结果：没有可执行的步骤、正忙，或这一步失败并已作废。 */
export type HistoryResult =
	| { ok: true }
	| { ok: false; reason: "empty" | "busy" }
	| { ok: false; reason: "failed"; error: unknown };

/** `createHistory` 的选项。 */
export interface HistoryOptions {
	/**
	 * 最多保留的步数。
	 * @default 50
	 */
	limit?: number;
	/** 撤销或重做失败、该步已作废时调用。 */
	onError?: (error: unknown, command: HistoryCommand) => void;
}

/** 命令式的撤销重做历史，只存在于当前会话。 */
export interface CommandHistory {
	/** 记录一步已经执行的操作；新操作清空重做栈。 */
	push(command: HistoryCommand): void;
	undo(): Promise<HistoryResult>;
	redo(): Promise<HistoryResult>;
	/** 清空历史，进行中的撤销或重做完成后也不再记入。 */
	clear(): void;
	getState(): HistoryState;
	subscribe(listener: () => void): () => void;
}

type Kind = "undo" | "redo";
const OPPOSITE = { undo: "redo", redo: "undo" } as const;

/** 订阅者或 `onError` 自己出错不能破坏历史，也不该被吞掉：抛到全局错误里。 */
const reportLater = (error: unknown) =>
	queueMicrotask(() => {
		throw error;
	});

/**
 * 创建撤销重做历史。
 *
 * 撤销与重做都是一次真实的反向或正向操作，走使用方的持久化：失败时这一步作废，既不能再撤销也不能重做；
 * 一次只处理一步，进行中再调用会被忽略。
 */
export function createHistory(options: HistoryOptions = {}): CommandHistory {
	const requested = options.limit ?? 50;
	const limit = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 50;
	const stacks: Record<Kind, HistoryCommand[]> = { undo: [], redo: [] };
	let busy = false;
	/** 每次 push 或 clear 递增：进行中的操作据此知道历史已经被改写。 */
	let generation = 0;
	let last: HistoryOutcome | undefined;
	let sequence = 0;
	const listeners = new Set<() => void>();

	const compute = (): HistoryState => ({
		canUndo: stacks.undo.length > 0 && !busy,
		canRedo: stacks.redo.length > 0 && !busy,
		busy,
		undoLabel: stacks.undo.at(-1)?.label,
		redoLabel: stacks.redo.at(-1)?.label,
		last,
	});
	let state = compute();
	const emit = () => {
		state = compute();
		for (const listener of listeners) {
			try {
				listener();
			} catch (error) {
				reportLater(error);
			}
		}
	};
	/** 去掉最后一次出现的这个命令：同一个对象可能被推入多次。 */
	const removeLast = (stack: HistoryCommand[], command: HistoryCommand) => {
		const index = stack.lastIndexOf(command);
		return index === -1 ? stack : [...stack.slice(0, index), ...stack.slice(index + 1)];
	};
	const append = (stack: HistoryCommand[], command: HistoryCommand) =>
		[...stack, command].slice(-limit);

	async function step(kind: Kind): Promise<HistoryResult> {
		if (busy) return { ok: false, reason: "busy" };
		const command = stacks[kind].at(-1);
		if (!command) return { ok: false, reason: "empty" };
		busy = true;
		const started = generation;
		emit();
		let failure: { error: unknown } | undefined;
		try {
			await command[kind]();
		} catch (error) {
			failure = { error };
		}
		stacks[kind] = removeLast(stacks[kind], command);
		if (!failure && generation === started)
			stacks[OPPOSITE[kind]] = append(stacks[OPPOSITE[kind]], command);
		busy = false;
		last = { kind, ok: !failure, label: command.label, seq: ++sequence };
		emit();
		if (!failure) return { ok: true };
		try {
			options.onError?.(failure.error, command);
		} catch (error) {
			reportLater(error);
		}
		return { ok: false, reason: "failed", error: failure.error };
	}

	return {
		push(command) {
			generation += 1;
			stacks.undo = append(stacks.undo, command);
			stacks.redo = [];
			emit();
		},
		undo: () => step("undo"),
		redo: () => step("redo"),
		clear() {
			generation += 1;
			stacks.undo = [];
			stacks.redo = [];
			emit();
		},
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
