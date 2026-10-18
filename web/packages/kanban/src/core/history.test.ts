import { describe, expect, it, vi } from "vitest";
import { createHistory, type HistoryCommand } from "./history.ts";

const command = (
	log: string[],
	name: string,
	overrides: Partial<HistoryCommand> = {},
): HistoryCommand => ({
	label: name,
	undo: () => {
		log.push(`undo ${name}`);
	},
	redo: () => {
		log.push(`redo ${name}`);
	},
	...overrides,
});

/** 手动控制何时完成的异步操作。 */
function deferred() {
	let resolve: () => void = () => {};
	let reject: (error: unknown) => void = () => {};
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe("createHistory", () => {
	it("空历史既不能撤销也不能重做", async () => {
		const history = createHistory();

		expect(history.getState()).toMatchObject({ canUndo: false, canRedo: false, busy: false });
		expect(await history.undo()).toEqual({ ok: false, reason: "empty" });
		expect(await history.redo()).toEqual({ ok: false, reason: "empty" });
	});

	it("撤销执行命令的反向操作，重做执行正向操作，顺序与栈一致", async () => {
		const log: string[] = [];
		const history = createHistory();
		history.push(command(log, "a"));
		history.push(command(log, "b"));

		await history.undo();
		await history.undo();
		await history.redo();
		await history.redo();

		expect(log).toEqual(["undo b", "undo a", "redo a", "redo b"]);
	});

	it("状态给出下一步撤销与重做的名称", async () => {
		const history = createHistory();
		history.push(command([], "move #1"));
		history.push(command([], "edit #2"));

		expect(history.getState()).toMatchObject({
			canUndo: true,
			undoLabel: "edit #2",
			canRedo: false,
		});
		await history.undo();
		expect(history.getState()).toMatchObject({
			undoLabel: "move #1",
			canRedo: true,
			redoLabel: "edit #2",
		});
	});

	it("新操作清空重做栈", async () => {
		const history = createHistory();
		history.push(command([], "a"));
		await history.undo();
		expect(history.getState().canRedo).toBe(true);

		history.push(command([], "b"));

		expect(history.getState().canRedo).toBe(false);
	});

	it("最多保留 50 步，超出的最早的步骤被丢弃", async () => {
		const log: string[] = [];
		const history = createHistory();
		for (let index = 0; index < 51; index += 1) history.push(command(log, `c${index}`));

		let undone = 0;
		while ((await history.undo()).ok) undone += 1;

		expect(undone).toBe(50);
		expect(log).not.toContain("undo c0");
		expect(log.at(-1)).toBe("undo c1");
	});

	it("容量可调，重做时放回的步骤同样受限", async () => {
		const history = createHistory({ limit: 2 });
		for (const name of ["a", "b", "c"]) history.push(command([], name));

		await history.undo();
		await history.undo();
		await history.redo();
		await history.redo();

		expect(history.getState().undoLabel).toBe("c");
		let steps = 0;
		while ((await history.undo()).ok) steps += 1;
		expect(steps).toBe(2);
	});

	it("撤销失败：该历史项作废，不进入重做栈，更早的步骤仍可撤销，并触发 onError", async () => {
		const log: string[] = [];
		const error = new Error("save failed");
		const onError = vi.fn();
		const history = createHistory({ onError });
		history.push(command(log, "a"));
		const failing = command(log, "b", { undo: () => Promise.reject(error) });
		history.push(failing);

		const result = await history.undo();

		expect(result).toEqual({ ok: false, reason: "failed", error });
		expect(onError).toHaveBeenCalledWith(error, failing);
		expect(history.getState()).toMatchObject({ canRedo: false, canUndo: true, undoLabel: "a" });
		expect((await history.undo()).ok).toBe(true);
		expect(log).toEqual(["undo a"]);
	});

	it("撤销同步抛错与拒绝一样作废", async () => {
		const history = createHistory();
		history.push(
			command([], "a", {
				undo: () => {
					throw new Error("boom");
				},
			}),
		);

		expect((await history.undo()).ok).toBe(false);
		expect(history.getState()).toMatchObject({ canUndo: false, canRedo: false });
	});

	it("重做失败同样作废：既不回到撤销栈也不留在重做栈", async () => {
		const history = createHistory();
		history.push(command([], "a", { redo: () => Promise.reject(new Error("no")) }));
		await history.undo();

		const result = await history.redo();

		expect(result.ok).toBe(false);
		expect(history.getState()).toMatchObject({ canUndo: false, canRedo: false });
	});

	it("撤销进行中状态忙，按钮据此禁用；此时再撤销被忽略", async () => {
		const gate = deferred();
		const history = createHistory();
		history.push(command([], "a", { undo: () => gate.promise }));
		history.push(command([], "b"));

		const first = history.undo();
		expect(history.getState().busy).toBe(true);
		expect(history.getState().canUndo).toBe(false);
		expect(await history.undo()).toEqual({ ok: false, reason: "busy" });

		await first;
		expect(history.getState().busy).toBe(false);
	});

	it("撤销进行中出现新操作：完成后被撤销的步骤不会回到重做栈", async () => {
		const gate = deferred();
		const history = createHistory();
		history.push(command([], "a", { undo: () => gate.promise }));

		const pending = history.undo();
		history.push(command([], "b"));
		gate.resolve();
		await pending;

		expect(history.getState().canRedo).toBe(false);
		expect(history.getState().undoLabel).toBe("b");
	});

	it("命令可以带着被自动清空的字段，撤销等恢复完成后才算完成", async () => {
		// 条目移出「已完成」时，完成日期与交付版本被后端清空；恢复要走一次异步的保存
		const item = {
			stage: "done",
			completedAt: "2026-10-18" as string | undefined,
			version: "v1.2" as string | undefined,
		};
		const gate = deferred();
		const moveOut = () => {
			const snapshot = { completedAt: item.completedAt, version: item.version };
			item.stage = "doing";
			item.completedAt = undefined;
			item.version = undefined;
			return command([], "move out of done", {
				undo: async () => {
					await gate.promise;
					item.stage = "done";
					Object.assign(item, snapshot);
				},
				redo: () => {
					item.stage = "doing";
					item.completedAt = undefined;
					item.version = undefined;
				},
			});
		};
		const history = createHistory();
		history.push(moveOut());

		const pending = history.undo();
		expect(history.getState().busy).toBe(true);
		expect(item.completedAt).toBeUndefined();
		gate.resolve();
		expect(await pending).toEqual({ ok: true });

		expect(item).toEqual({ stage: "done", completedAt: "2026-10-18", version: "v1.2" });
		await history.redo();
		expect(item).toEqual({ stage: "doing", completedAt: undefined, version: undefined });
	});

	it("同一个命令对象推入两次，两步都能撤销与重做", async () => {
		const log: string[] = [];
		const shared = command(log, "same");
		const history = createHistory();
		history.push(shared);
		history.push(shared);

		expect((await history.undo()).ok).toBe(true);
		expect(history.getState().canUndo).toBe(true);
		expect((await history.undo()).ok).toBe(true);
		expect(history.getState().canUndo).toBe(false);
		expect((await history.redo()).ok).toBe(true);
		expect((await history.redo()).ok).toBe(true);

		expect(log).toEqual(["undo same", "undo same", "redo same", "redo same"]);
	});

	it("onError 自己抛错：撤销仍然返回失败结果，历史保持一致", async () => {
		const reported: unknown[] = [];
		const microtask = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
			try {
				callback();
			} catch (error) {
				reported.push(error);
			}
		});
		const history = createHistory({
			onError: () => {
				throw new Error("hook bug");
			},
		});
		history.push(command([], "a", { undo: () => Promise.reject(new Error("no")) }));

		const result = await history.undo();
		microtask.mockRestore();

		expect(result.ok).toBe(false);
		expect(history.getState()).toMatchObject({ busy: false, canUndo: false, canRedo: false });
		expect(reported).toHaveLength(1);
	});

	it("订阅者抛错不会让历史卡在忙状态，错误被抛到全局而不是吞掉", async () => {
		const reported: unknown[] = [];
		const microtask = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
			try {
				callback();
			} catch (error) {
				reported.push(error);
			}
		});
		const history = createHistory();
		history.push(command([], "a"));
		history.push(command([], "b"));
		history.subscribe(() => {
			throw new Error("subscriber bug");
		});

		const first = await history.undo();
		const second = await history.undo();
		microtask.mockRestore();

		expect([first.ok, second.ok]).toEqual([true, true]);
		expect(history.getState().busy).toBe(false);
		expect(reported.length).toBeGreaterThan(0);
	});

	it("limit 不是有限数时用默认的 50，而不是变成不限", async () => {
		for (const limit of [Number.NaN, Number.POSITIVE_INFINITY]) {
			const history = createHistory({ limit });
			for (let index = 0; index < 60; index += 1) history.push(command([], `c${index}`));

			let steps = 0;
			while ((await history.undo()).ok) steps += 1;

			expect(steps).toBe(50);
		}
	});

	it("订阅者在状态变化时被通知，取消订阅后不再通知；无变化时状态引用不变", async () => {
		const history = createHistory();
		const listener = vi.fn();
		const unsubscribe = history.subscribe(listener);
		const before = history.getState();
		expect(history.getState()).toBe(before);

		history.push(command([], "a"));
		await history.undo();
		expect(listener).toHaveBeenCalled();
		const calls = listener.mock.calls.length;

		unsubscribe();
		history.push(command([], "b"));
		expect(listener.mock.calls.length).toBe(calls);
	});

	it("状态记录最近一次撤销或重做的结果，重复的相同结果序号也会变化", async () => {
		const history = createHistory();
		history.push(command([], "a"));
		history.push(command([], "b"));

		await history.undo();
		const first = history.getState().last;
		await history.undo();
		const second = history.getState().last;

		expect(first).toMatchObject({ kind: "undo", ok: true, label: "b" });
		expect(second).toMatchObject({ kind: "undo", ok: true, label: "a" });
		expect(second?.seq).toBeGreaterThan(first?.seq ?? 0);
	});

	it("clear 清空两个栈，也让进行中的撤销不再回到重做栈", async () => {
		const gate = deferred();
		const history = createHistory();
		history.push(command([], "a", { undo: () => gate.promise }));
		const pending = history.undo();

		history.clear();
		gate.resolve();
		await pending;

		expect(history.getState()).toMatchObject({ canUndo: false, canRedo: false });
	});
});
