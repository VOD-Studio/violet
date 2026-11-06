import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UseFieldCheckOptions, useFieldCheck } from "../use-field-check";

const email = (value: string) =>
	/^\S+@\S+\.\S+$/.test(value) ? undefined : "邮箱格式不正确，缺少 @ 或域名";

function setup(options: Partial<UseFieldCheckOptions<string>> & { value: string }) {
	return renderHook((props: UseFieldCheckOptions<string>) => useFieldCheck(props), {
		initialProps: options as UseFieldCheckOptions<string>,
	});
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useFieldCheck 同步检查", () => {
	it("失焦前不显示错误，失焦后才显示", () => {
		const { result } = setup({ value: "abc", validate: email });
		expect(result.current.error).toBeUndefined();

		act(() => result.current.fieldProps.onBlur());
		expect(result.current.error).toBe("邮箱格式不正确，缺少 @ 或域名");
	});

	it("失焦后随值实时重算，改对即消", () => {
		const { result, rerender } = setup({ value: "abc", validate: email });
		act(() => result.current.fieldProps.onBlur());
		expect(result.current.error).toBeDefined();

		rerender({ value: "a@b.co", validate: email });
		expect(result.current.error).toBeUndefined();

		rerender({ value: "a@b", validate: email });
		expect(result.current.error).toBe("邮箱格式不正确，缺少 @ 或域名");
	});

	it("touch() 立刻暴露错误，reset() 回到未触碰", () => {
		const { result } = setup({ value: "", validate: (v) => (v ? undefined : "请填写标题") });
		act(() => result.current.touch());
		expect(result.current.error).toBe("请填写标题");

		act(() => result.current.reset());
		expect(result.current.error).toBeUndefined();
	});

	it('revealOn="change" 不等失焦，边输入边显示', () => {
		const { result } = setup({
			value: "a",
			validate: (v) => (v.length < 3 ? "至少 3 个字符" : undefined),
			revealOn: "change",
		});
		expect(result.current.error).toBe("至少 3 个字符");
	});

	it("同步检查通过时普通字段不是 valid", () => {
		const { result } = setup({ value: "a@b.co", validate: email });
		act(() => result.current.touch());
		expect(result.current.error).toBeUndefined();
		expect(result.current.valid).toBe(false);
		expect(result.current.checking).toBe(false);
	});
});

describe("useFieldCheck 异步检查", () => {
	const taken = new Set(["admin", "rua"]);

	function asyncSetup() {
		const validateAsync = vi.fn(async (value: string, _signal: AbortSignal) =>
			taken.has(value) ? "已被占用，换一个试试" : undefined,
		);
		const validate = (v: string) =>
			v.length > 0 && v.length < 3 ? "至少 3 个字符" : undefined;
		const hook = setup({ value: "", validate, validateAsync });
		const rerender = (next: UseFieldCheckOptions<string>) =>
			hook.rerender({ validate, validateAsync, ...next });
		return { ...hook, rerender, validateAsync };
	}

	it("停手 600ms 才发请求，发起后 checking 为 true，结果到达才有 valid", async () => {
		const { result, rerender, validateAsync } = asyncSetup();
		rerender({ value: "xunrua", validateAsync });

		act(() => {
			vi.advanceTimersByTime(599);
		});
		expect(validateAsync).not.toHaveBeenCalled();
		expect(result.current.checking).toBe(false);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(validateAsync).toHaveBeenCalledTimes(1);
		expect(result.current.checking).toBe(true);
		expect(result.current.valid).toBe(false);

		await act(async () => {});
		expect(result.current.checking).toBe(false);
		expect(result.current.valid).toBe(true);
		expect(result.current.error).toBeUndefined();
	});

	it("连续改值只发最后一次，上一次的请求被取消", async () => {
		const signals: AbortSignal[] = [];
		const validateAsync = vi.fn(async (_value: string, signal: AbortSignal) => {
			signals.push(signal);
			return undefined;
		});
		const { rerender } = setup({ value: "", validateAsync });

		rerender({ value: "abc", validateAsync });
		act(() => {
			vi.advanceTimersByTime(300);
		});
		rerender({ value: "abcd", validateAsync });
		act(() => {
			vi.advanceTimersByTime(600);
		});
		expect(validateAsync).toHaveBeenCalledTimes(1);
		expect(validateAsync).toHaveBeenLastCalledWith("abcd", expect.any(AbortSignal));

		rerender({ value: "abcde", validateAsync });
		expect(signals[0]?.aborted).toBe(true);
	});

	it("异步错误不受失焦门控，结果到达即显示；改值后立刻清掉", async () => {
		const { result, rerender, validateAsync } = asyncSetup();
		rerender({ value: "admin", validateAsync });
		await act(async () => {
			vi.advanceTimersByTime(600);
		});
		expect(result.current.error).toBe("已被占用，换一个试试");
		expect(result.current.valid).toBe(false);

		rerender({ value: "admins", validateAsync });
		expect(result.current.error).toBeUndefined();
	});

	it("被取消的旧请求即使晚到也不会写入结果", async () => {
		let resolveFirst: (message: string | undefined) => void = () => {};
		const validateAsync = vi.fn((value: string) =>
			value === "admin"
				? new Promise<string | undefined>((resolve) => {
						resolveFirst = resolve;
					})
				: Promise.resolve(undefined),
		);
		const { result, rerender } = setup({ value: "", validateAsync });

		rerender({ value: "admin", validateAsync });
		act(() => {
			vi.advanceTimersByTime(600);
		});
		rerender({ value: "adminx", validateAsync });
		await act(async () => {
			resolveFirst("已被占用，换一个试试");
		});
		expect(result.current.error).toBeUndefined();
	});

	it("同步检查没过或值为空时不发异步，valid 为 false", () => {
		const { result, rerender, validateAsync } = asyncSetup();
		rerender({ value: "ab", validateAsync });
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(validateAsync).not.toHaveBeenCalled();

		rerender({ value: "", validateAsync });
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(validateAsync).not.toHaveBeenCalled();
		expect(result.current.valid).toBe(false);
	});

	it("asyncDelay 可调", () => {
		const validateAsync = vi.fn(async () => undefined);
		const { rerender } = setup({ value: "", validateAsync, asyncDelay: 100 });
		rerender({ value: "abc", validateAsync, asyncDelay: 100 });
		act(() => {
			vi.advanceTimersByTime(100);
		});
		expect(validateAsync).toHaveBeenCalledTimes(1);
	});

	it("卸载时清理计时器并取消在途请求", () => {
		let signal: AbortSignal | undefined;
		const validateAsync = vi.fn(async (_value: string, s: AbortSignal) => {
			signal = s;
			return undefined;
		});
		const pending = setup({ value: "", validateAsync });
		pending.rerender({ value: "abc", validateAsync });
		pending.unmount();
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(validateAsync).not.toHaveBeenCalled();

		const inFlight = setup({ value: "", validateAsync });
		inFlight.rerender({ value: "abc", validateAsync });
		act(() => {
			vi.advanceTimersByTime(600);
		});
		inFlight.unmount();
		expect(signal?.aborted).toBe(true);
	});

	it("reset() 清掉异步结果", async () => {
		const { result, rerender, validateAsync } = asyncSetup();
		rerender({ value: "xunrua", validateAsync });
		await act(async () => {
			vi.advanceTimersByTime(600);
		});
		expect(result.current.valid).toBe(true);

		act(() => result.current.reset());
		expect(result.current.valid).toBe(false);
	});
});

describe("useFieldCheck 轮次与重置", () => {
	const taken = (value: string) => (value === "admin" ? "已被占用，换一个试试" : undefined);

	function roundSetup() {
		const validateAsync = vi.fn(async (value: string) => taken(value));
		const hook = setup({ value: "", validateAsync });
		const rerender = (value: string) => hook.rerender({ value, validateAsync });
		return { ...hook, rerender, validateAsync };
	}

	it("值 admin → 别的 → admin：新一轮等待期内不出现上一轮的错误，也不 valid", async () => {
		const { result, rerender } = roundSetup();
		rerender("admin");
		await act(async () => {
			vi.advanceTimersByTime(600);
		});
		expect(result.current.error).toBe("已被占用，换一个试试");

		rerender("other");
		rerender("admin");
		expect(result.current.error).toBeUndefined();
		expect(result.current.valid).toBe(false);
		act(() => {
			vi.advanceTimersByTime(599);
		});
		expect(result.current.error).toBeUndefined();
		expect(result.current.valid).toBe(false);

		await act(async () => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.error).toBe("已被占用，换一个试试");
	});

	it("旧的通过结果在值改回同一个值时也不会让 valid 提前为 true", async () => {
		const { result, rerender } = roundSetup();
		rerender("xunrua");
		await act(async () => {
			vi.advanceTimersByTime(600);
		});
		expect(result.current.valid).toBe(true);

		rerender("xunrua2");
		rerender("xunrua");
		expect(result.current.valid).toBe(false);
	});

	it("等待期内 reset()：计时器取消，值不变也不会再发请求或回写", async () => {
		const { result, rerender, validateAsync } = roundSetup();
		rerender("admin");
		act(() => {
			vi.advanceTimersByTime(300);
		});
		act(() => result.current.reset());
		await act(async () => {
			vi.advanceTimersByTime(2000);
		});
		expect(validateAsync).not.toHaveBeenCalled();
		expect(result.current.error).toBeUndefined();
		expect(result.current.valid).toBe(false);
		expect(result.current.checking).toBe(false);
	});

	it("请求在途时 reset()：中止请求，晚到的结果不再回写", async () => {
		let signal: AbortSignal | undefined;
		let finish: (message: string | undefined) => void = () => {};
		const validateAsync = vi.fn((_value: string, s: AbortSignal) => {
			signal = s;
			return new Promise<string | undefined>((resolve) => {
				finish = resolve;
			});
		});
		const { result, rerender } = setup({ value: "", validateAsync });
		rerender({ value: "admin", validateAsync });
		act(() => {
			vi.advanceTimersByTime(600);
		});
		expect(result.current.checking).toBe(true);

		act(() => result.current.reset());
		expect(signal?.aborted).toBe(true);
		expect(result.current.checking).toBe(false);
		await act(async () => {
			finish("已被占用，换一个试试");
		});
		expect(result.current.error).toBeUndefined();
		expect(result.current.valid).toBe(false);
	});
});
