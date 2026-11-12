/// <reference lib="es2024.promise" />

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendButton } from "../index";

function deferred() {
	return Promise.withResolvers<boolean>();
}

afterEach(() => {
	vi.useRealTimers();
});

describe("ResendButton", () => {
	it("只在成功后冷却，60秒最后一秒仍不可点击，到零恢复文字按钮", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const send = vi.fn(() => true);
		render(<ResendButton onResend={send} />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(true);
		act(() => vi.advanceTimersByTime(59000));
		fireEvent.click(button);
		expect(send).toHaveBeenCalledOnce();
		act(() => vi.advanceTimersByTime(999));
		expect(button.disabled).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("同步false与异步false不进入冷却，修正邮箱后立即可以再次发送", async () => {
		const send = vi.fn<() => boolean | Promise<boolean>>();
		send.mockReturnValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		render(<ResendButton onResend={send} />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(true);
	});

	it("pending 期间双击和同一批次点击只发一次，等待成功后才起算完整冷却", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const pending = deferred();
		const send = vi.fn(() => pending.promise);
		render(<ResendButton onResend={send} cooldownSeconds={2} />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		act(() => {
			button.click();
			button.click();
		});
		expect(send).toHaveBeenCalledOnce();
		expect(button.getAttribute("aria-busy")).toBe("true");
		act(() => vi.advanceTimersByTime(10000));
		expect(button.disabled).toBe(true);
		await act(async () => pending.resolve(true));
		expect(button.getAttribute("aria-busy")).not.toBe("true");
		act(() => vi.advanceTimersByTime(1999));
		expect(button.disabled).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(button.disabled).toBe(false);
	});

	it("抛错和拒绝交给调用方，解除pending且不误入冷却", async () => {
		const error = new Error("邮箱服务暂不可用");
		const onError = vi.fn();
		const send = vi.fn<() => boolean | Promise<boolean>>();
		send.mockImplementationOnce(() => {
			throw error;
		})
			.mockRejectedValueOnce(error)
			.mockReturnValueOnce(true);
		render(<ResendButton onResend={send} onError={onError} />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(onError.mock.calls).toEqual([[error], [error]]);
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(true);
	});

	it.each([
		true,
		false,
	])("换邮箱后旧请求成功=%s不污染新邮箱，也不解除新请求pending", async (success) => {
		const old = deferred();
		const fresh = deferred();
		const onError = vi.fn();
		const send = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
		const { rerender } = render(
			<ResendButton onResend={send} onError={onError} resetKey="old@example.com" />,
		);
		fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
		rerender(<ResendButton onResend={send} onError={onError} resetKey="new@example.com" />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		fireEvent.click(button);
		await act(async () => {
			if (success) old.resolve(true);
			else old.reject(new Error("旧邮箱失败"));
		});
		expect(button.disabled).toBe(true);
		expect(onError).not.toHaveBeenCalled();
		await act(async () => fresh.resolve(true));
		expect(button.disabled).toBe(true);
		expect(button.getAttribute("aria-busy")).not.toBe("true");
	});

	it("换邮箱立即结束已有冷却，旧计时不回写新状态", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const { rerender } = render(<ResendButton onResend={() => true} resetKey="one" />);
		await act(async () => fireEvent.click(screen.getByRole("button", { name: "重新发送" })));
		expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
		rerender(<ResendButton onResend={() => true} resetKey="two" />);
		expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
		act(() => vi.advanceTimersByTime(60000));
		expect(
			(screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement).disabled,
		).toBe(false);
	});

	it("后台跨过截止时间按墙钟结束，不会按遗漏tick延长冷却", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		render(<ResendButton onResend={() => true} cooldownSeconds={3} />);
		await act(async () => fireEvent.click(screen.getByRole("button", { name: "重新发送" })));
		vi.setSystemTime(10000);
		act(() => vi.advanceTimersByTime(250));
		expect(
			(screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement).disabled,
		).toBe(false);
	});

	it("原生ref和preventDefault保留，按钮不提交表单，禁用不发送", async () => {
		const ref = createRef<HTMLButtonElement>();
		const send = vi.fn();
		const submit = vi.fn((event) => event.preventDefault());
		const { rerender } = render(
			<form onSubmit={submit}>
				<ResendButton
					ref={ref}
					onResend={send}
					onClick={(event) => event.preventDefault()}
				/>
			</form>,
		);
		expect(ref.current).toBe(screen.getByRole("button"));
		await act(async () => fireEvent.click(ref.current as HTMLButtonElement));
		expect(send).not.toHaveBeenCalled();
		expect(submit).not.toHaveBeenCalled();
		rerender(<ResendButton ref={ref} onResend={send} disabled />);
		fireEvent.click(ref.current as HTMLButtonElement);
		expect(send).not.toHaveBeenCalled();
	});

	it("零秒冷却与async void成功不锁住下一次发送，外部disabled独立于计时", async () => {
		const send = vi.fn(async () => {});
		const { rerender } = render(<ResendButton onResend={send} cooldownSeconds={0} />);
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(send).toHaveBeenCalledTimes(2);
		rerender(<ResendButton onResend={send} cooldownSeconds={0} disabled />);
		expect(button.disabled).toBe(true);
	});

	it("卸载后迟到的异常不通知旧消费方", async () => {
		const pending = deferred();
		const onError = vi.fn();
		const second = render(<ResendButton onResend={() => pending.promise} onError={onError} />);
		fireEvent.click(screen.getByRole("button"));
		second.unmount();
		await act(async () => pending.reject(new Error("迟到的错误")));
		expect(onError).not.toHaveBeenCalled();
	});

	it("旧邮箱切走再切回仍是新发送会话，旧成功结果不能建立倒计时", async () => {
		vi.useFakeTimers();
		const old = deferred();
		const send = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(true);
		const { rerender } = render(<ResendButton onResend={send} resetKey="first" />);
		fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
		rerender(<ResendButton onResend={send} resetKey="second" />);
		rerender(<ResendButton onResend={send} resetKey="first" />);
		await act(async () => old.resolve(true));
		const button = screen.getByRole("button", { name: "重新发送" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		await act(async () => fireEvent.click(button));
		expect(button.disabled).toBe(true);
	});
});
