import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressBar, ProgressRing } from "../progress";

afterEach(cleanup);

describe("ProgressBar", () => {
	it("把名称、范围与当前值交给 progressbar", () => {
		render(<ProgressBar value={42} label="上传 cover-season.webp" hint="42 / 100 MB" />);
		const bar = screen.getByRole("progressbar", { name: "上传 cover-season.webp" });
		expect(bar.getAttribute("aria-valuemin")).toBe("0");
		expect(bar.getAttribute("aria-valuemax")).toBe("100");
		expect(bar.getAttribute("aria-valuenow")).toBe("42");
		expect(bar.getAttribute("aria-valuetext")).toBe("42%");
		expect(screen.getByText("42 / 100 MB")).toBeTruthy();
	});

	it("值超出范围按边界处理", () => {
		const { rerender } = render(<ProgressBar value={-10} label="进度" />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
		rerender(<ProgressBar value={140} label="进度" />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
	});

	it("完成与失败用文字表达结果，不只靠颜色", () => {
		const { rerender } = render(<ProgressBar value={100} label="上传" status="success" />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("已完成");
		rerender(<ProgressBar value={63} label="上传" status="error" hint="网络中断" />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("63%，失败");
		expect(screen.getByText("网络中断")).toBeTruthy();
	});

	it("分段只补充阶段，不改变进度值", () => {
		render(<ProgressBar value={21} label="路线图" segments={{ count: 5, active: 3 }} />);
		const segments = document.querySelectorAll(".v-progress__segments i");
		expect(segments).toHaveLength(5);
		expect(segments[2]?.hasAttribute("data-active")).toBe(true);
		expect(segments[3]?.hasAttribute("data-active")).toBe(false);
		expect(document.querySelector(".v-progress__segments")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});
});

describe("ProgressRing", () => {
	it("圆环同样暴露进度值，数字写在圆心并带名称与说明", () => {
		render(<ProgressRing value={65} label="本月阅读目标" description="已读 13 / 20 篇" />);
		const ring = screen.getByRole("progressbar", { name: "本月阅读目标" });
		expect(ring.getAttribute("aria-valuenow")).toBe("65");
		expect(screen.getByText("65%")).toBeTruthy();
		expect(screen.getByText("已读 13 / 20 篇")).toBeTruthy();
	});

	it("用归一化路径画弧，32 与 48 两档线宽不同", () => {
		const { rerender } = render(<ProgressRing value={50} label="目标" />);
		let fill = document.querySelector(".v-progress-ring__fill");
		expect(fill?.getAttribute("pathLength")).toBe("100");
		expect(fill?.getAttribute("stroke-dasharray")).toBe("100 100");
		expect(fill?.getAttribute("style")).toContain("stroke-dashoffset: 50");
		expect(fill?.getAttribute("stroke-width")).toBe("4");
		rerender(<ProgressRing value={50} label="目标" size={32} />);
		fill = document.querySelector(".v-progress-ring__fill");
		expect(fill?.getAttribute("stroke-width")).toBe("3");
	});

	it("没有名称时仍带一个可读的默认名称", () => {
		render(<ProgressRing value={10} />);
		expect(screen.getByRole("progressbar", { name: "进度" })).toBeTruthy();
	});
});
