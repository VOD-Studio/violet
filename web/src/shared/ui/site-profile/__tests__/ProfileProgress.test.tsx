import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileProgress } from "../ProfileProgress";

describe("ProfileProgress", () => {
	afterEach(cleanup);

	it("已播、轨道与总时长；轨道带读屏数值，宽度取自 ratio", () => {
		render(<ProfileProgress elapsed="1:23" total="3:45" ratio={0.36} />);
		expect(screen.getByText("1:23")).toBeTruthy();
		expect(screen.getByText("3:45")).toBeTruthy();
		const bar = screen.getByRole("progressbar", { name: "播放进度" });
		expect(bar.getAttribute("aria-valuenow")).toBe("36");
		expect(bar.getAttribute("aria-valuemin")).toBe("0");
		expect(bar.getAttribute("aria-valuemax")).toBe("100");
		expect((bar.firstElementChild as HTMLElement).style.width).toBe("36%");
	});

	it("没有总时长或比例时只显示已播文字", () => {
		render(<ProfileProgress elapsed="0:07" />);
		expect(screen.getByText("0:07")).toBeTruthy();
		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("比例越界时钳到 0–100", () => {
		render(<ProfileProgress elapsed="9:99" total="3:45" ratio={1.4} />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
	});
});
