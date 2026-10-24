import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncContent, DeferredContent } from "./DeferredContent";

function EnhancedBlock() {
	const [count, setCount] = useState(0);
	return (
		<button type="button" onClick={() => setCount((value) => value + 1)}>
			增强交互 {count}
		</button>
	);
}

const loadEnhancedBlock = async () => ({ default: EnhancedBlock });

afterEach(() => vi.restoreAllMocks());

describe("DeferredContent", () => {
	it("模块加载失败只影响所属块，重试后恢复交互而不替换正文", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const load = vi.fn(loadEnhancedBlock).mockRejectedValueOnce(new Error("资源下载失败"));
		render(
			<>
				<main>已显示的正文</main>
				<DeferredContent
					defer={false}
					load={load}
					componentProps={{}}
					fallback={<pre>可读源码</pre>}
					label="图表"
				/>
			</>,
		);
		const body = screen.getByText("已显示的正文");
		await screen.findByRole("alert");
		expect(screen.getByText("可读源码").tagName).toBe("PRE");
		expect(screen.getByText("已显示的正文")).toBe(body);
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		fireEvent.click(await screen.findByRole("button", { name: "增强交互 0" }));
		expect(screen.getByRole("button", { name: "增强交互 1" })).toBeTruthy();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("已显示的正文")).toBe(body);
	});

	it("父级更新不会重新挂载已完成模块或重置读者的交互状态", async () => {
		const { rerender } = render(
			<DeferredContent
				defer={false}
				load={loadEnhancedBlock}
				componentProps={{}}
				fallback={<pre>源码</pre>}
				label="代码"
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "增强交互 0" }));
		const button = screen.getByRole("button", { name: "增强交互 1" });
		rerender(
			<DeferredContent
				defer={false}
				load={loadEnhancedBlock}
				componentProps={{}}
				fallback={<pre>源码</pre>}
				label="代码"
			/>,
		);
		expect(screen.getByRole("button", { name: "增强交互 1" })).toBe(button);
	});

	it("行内增强失败与重试不拆开正文段落", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const load = vi
			.fn(async () => ({ default: () => <span>已排版公式</span> }))
			.mockRejectedValueOnce(new Error("公式模块下载失败"));
		render(
			<p>
				公式前文
				<AsyncContent
					inline
					load={load}
					componentProps={{}}
					label="公式"
					fallback={<span>E=mc²</span>}
				/>
				公式后文
			</p>,
		);
		const paragraph = screen.getByText("公式前文", { exact: false });
		expect((await screen.findByRole("alert")).tagName).toBe("SPAN");
		expect(screen.getByText("E=mc²").closest("p")).toBe(paragraph);
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		expect((await screen.findByText("已排版公式")).closest("p")).toBe(paragraph);
		expect(paragraph.textContent).toBe("公式前文已排版公式公式后文");
	});
});
