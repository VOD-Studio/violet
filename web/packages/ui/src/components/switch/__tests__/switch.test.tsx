import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "../switch";

describe("Switch", () => {
	it("是带 aria-checked 的 switch 角色，默认关闭，defaultChecked 决定初值", () => {
		const { unmount } = render(<Switch aria-label="深色模式" />);
		expect(screen.getByRole("switch", { name: "深色模式" }).getAttribute("aria-checked")).toBe(
			"false",
		);
		unmount();

		render(<Switch aria-label="深色模式" defaultChecked />);
		expect(screen.getByRole("switch", { name: "深色模式" }).getAttribute("aria-checked")).toBe(
			"true",
		);
	});
	it("元素是原生 button：可 Tab 聚焦，Space 与 Enter 由浏览器合成点击，不会提交所在表单", () => {
		const submit = vi.fn((event) => event.preventDefault());
		render(
			<form onSubmit={submit}>
				<Switch aria-label="允许评论" />
			</form>,
		);
		const control = screen.getByRole("switch", { name: "允许评论" }) as HTMLButtonElement;
		expect(control.tagName).toBe("BUTTON");
		expect(control.type).toBe("button");
		expect(control.tabIndex).toBe(0);
		control.focus();
		expect(document.activeElement).toBe(control);

		fireEvent.click(control);
		expect(control.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(control);
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(submit).not.toHaveBeenCalled();
	});

	it("非受控：点击切换并把新值交给 onCheckedChange", () => {
		const change = vi.fn();
		render(<Switch aria-label="自动保存" onCheckedChange={change} />);
		const control = screen.getByRole("switch", { name: "自动保存" });
		fireEvent.click(control);
		expect(change).toHaveBeenLastCalledWith(true);
		expect(control.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(control);
		expect(change).toHaveBeenLastCalledWith(false);
		expect(control.getAttribute("aria-checked")).toBe("false");
	});

	it("受控：点击只发出请求，状态由宿主确认后才变", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Switch aria-label="自动保存" checked={false} onCheckedChange={change} />,
		);
		const control = screen.getByRole("switch", { name: "自动保存" });
		fireEvent.click(control);
		expect(change).toHaveBeenCalledWith(true);
		expect(control.getAttribute("aria-checked")).toBe("false");

		rerender(<Switch aria-label="自动保存" checked onCheckedChange={change} />);
		expect(control.getAttribute("aria-checked")).toBe("true");
	});

	it("禁用：不切换、不回调，也不接收焦点", () => {
		const change = vi.fn();
		render(<Switch aria-label="同步" disabled onCheckedChange={change} />);
		const control = screen.getByRole("switch", { name: "同步" }) as HTMLButtonElement;
		fireEvent.click(control);
		expect(change).not.toHaveBeenCalled();
		expect(control.getAttribute("aria-checked")).toBe("false");
		expect(control.disabled).toBe(true);
		control.focus();
		expect(document.activeElement).not.toBe(control);
	});

	describe("loading", () => {
		it("声明 aria-busy，不改变可访问名称；结束后撤销", () => {
			const { rerender } = render(<Switch aria-label="公开个人主页" loading />);
			const control = screen.getByRole("switch", { name: "公开个人主页" });
			expect(control.getAttribute("aria-busy")).toBe("true");
			expect(control.textContent).toBe("");

			rerender(<Switch aria-label="公开个人主页" />);
			expect(control.getAttribute("aria-busy")).not.toBe("true");
		});

		it("忽略点击，不触发 onCheckedChange 与 onClick，仍可聚焦", () => {
			const change = vi.fn();
			const click = vi.fn();
			render(
				<Switch
					aria-label="公开个人主页"
					loading
					onCheckedChange={change}
					onClick={click}
				/>,
			);
			const control = screen.getByRole("switch", {
				name: "公开个人主页",
			}) as HTMLButtonElement;
			fireEvent.click(control);
			expect(change).not.toHaveBeenCalled();
			expect(click).not.toHaveBeenCalled();
			expect(control.getAttribute("aria-checked")).toBe("false");
			expect(control.disabled).toBe(false);
			control.focus();
			expect(document.activeElement).toBe(control);
		});

		it("非受控加载中也保持原值，结束后恢复响应", () => {
			const { rerender } = render(<Switch aria-label="公开" defaultChecked loading />);
			const control = screen.getByRole("switch", { name: "公开" });
			fireEvent.click(control);
			expect(control.getAttribute("aria-checked")).toBe("true");

			rerender(<Switch aria-label="公开" defaultChecked />);
			fireEvent.click(control);
			expect(control.getAttribute("aria-checked")).toBe("false");
		});

		it("外观跟随宿主传入的 checked：乐观翻转，失败后翻回", () => {
			function Harness() {
				const [on, setOn] = useState(false);
				const [busy, setBusy] = useState(false);
				return (
					<>
						<Switch
							aria-label="同步"
							checked={on}
							loading={busy}
							onCheckedChange={setOn}
						/>
						<button type="button" onClick={() => setBusy(true)}>
							开始请求
						</button>
						<button
							type="button"
							onClick={() => {
								setBusy(false);
								setOn(false);
							}}
						>
							请求失败
						</button>
					</>
				);
			}
			render(<Harness />);
			const control = screen.getByRole("switch", { name: "同步" });
			fireEvent.click(control);
			fireEvent.click(screen.getByText("开始请求"));
			expect(control.getAttribute("aria-checked")).toBe("true");
			expect(control.getAttribute("aria-busy")).toBe("true");
			fireEvent.click(control);
			expect(control.getAttribute("aria-checked")).toBe("true");

			fireEvent.click(screen.getByText("请求失败"));
			expect(control.getAttribute("aria-checked")).toBe("false");
			expect(control.getAttribute("aria-busy")).not.toBe("true");
		});

		it("加载指示器 200ms 后显示且不进入读屏树", () => {
			vi.useFakeTimers();
			const { container } = render(<Switch aria-label="公开" loading />);
			expect(container.querySelectorAll("svg").length).toBe(0);
			act(() => {
				vi.advanceTimersByTime(200);
			});
			const hidden = container.querySelectorAll("svg");
			expect(hidden.length).toBeGreaterThan(0);
			for (const svg of hidden) expect(svg.getAttribute("aria-hidden")).toBe("true");
			vi.useRealTimers();
		});
	});

	it("名称来自 aria-labelledby，错误说明经 aria-describedby 朗读", () => {
		render(
			<>
				<span id="label">同步到 Mastodon</span>
				<Switch aria-labelledby="label" aria-describedby="reason" aria-invalid />
				<p id="reason">服务端拒绝：授权已过期</p>
			</>,
		);
		const control = screen.getByRole("switch", { name: "同步到 Mastodon" });
		expect(control.getAttribute("aria-describedby")).toBe("reason");
		expect(control.getAttribute("aria-invalid")).toBe("true");
	});

	describe("表单", () => {
		it("开启时以 name/value 提交，关闭时不提交，value 默认 on", () => {
			const { container } = render(
				<form>
					<Switch name="notify" aria-label="通知" />
					<Switch name="digest" value="weekly" defaultChecked aria-label="摘要" />
				</form>,
			);
			const form = container.querySelector("form") as HTMLFormElement;
			expect(new FormData(form).has("notify")).toBe(false);
			expect(new FormData(form).get("digest")).toBe("weekly");

			fireEvent.click(screen.getByRole("switch", { name: "通知" }));
			expect(new FormData(form).get("notify")).toBe("on");
			fireEvent.click(screen.getByRole("switch", { name: "摘要" }));
			expect(new FormData(form).has("digest")).toBe(false);
		});

		it("通过 form 属性加入远处表单", () => {
			render(
				<>
					<form id="far" />
					<Switch name="notify" form="far" defaultChecked aria-label="通知" />
				</>,
			);
			const form = document.getElementById("far") as HTMLFormElement;
			expect(new FormData(form).get("notify")).toBe("on");
		});

		it("禁用的开关不提交", () => {
			const { container } = render(
				<form>
					<Switch name="notify" defaultChecked disabled aria-label="通知" />
				</form>,
			);
			expect(
				new FormData(container.querySelector("form") as HTMLFormElement).has("notify"),
			).toBe(false);
		});
	});

	it("保留 ref、id、className 与 data 属性", () => {
		const ref = createRef<HTMLButtonElement>();
		render(<Switch ref={ref} id="s1" className="custom" data-testid="sw" aria-label="开关" />);
		const control = screen.getByTestId("sw");
		expect(ref.current).toBe(control);
		expect(control.id).toBe("s1");
		expect(control.classList.contains("custom")).toBe(true);
	});

	it("服务端渲染输出 switch 语义与初始状态", () => {
		const html = renderToString(<Switch aria-label="深色" defaultChecked loading />);
		expect(html).toContain('role="switch"');
		expect(html).toContain('aria-checked="true"');
		expect(html).toContain('aria-busy="true"');
	});
});
