import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MiniBars } from "../mini-bars";
import { Stat } from "../stat";

afterEach(cleanup);

describe("Stat", () => {
	it("数字与变化读成一句完整的话，箭头只是装饰", () => {
		render(
			<Stat label="近 7 天访问" value="12,480" change={{ direction: "up", value: "18%" }} />,
		);
		const stat = screen.getByRole("group", {
			name: "近 7 天访问 12,480，比上周多 18%",
		});
		expect(stat.textContent).toContain("12,480");
		expect(stat.querySelector(".v-stat__change svg")?.getAttribute("aria-hidden")).toBe("true");
	});

	it("下降变化写成少，趋势线对读屏隐藏", () => {
		const { container } = render(
			<Stat
				label="跳出率"
				value="41%"
				change={{ direction: "down", value: "3%" }}
				trend={[12, 10, 14, 9, 8]}
			/>,
		);
		expect(screen.getByRole("group", { name: "跳出率 41%，比上周少 3%" })).toBeTruthy();
		const spark = container.querySelector(".v-stat__spark");
		expect(spark?.getAttribute("aria-hidden")).toBe("true");
		expect(spark?.querySelector("path")?.getAttribute("d")).toContain("M0");
	});
});

describe("MiniBars", () => {
	const data = [
		{ label: "周一", value: 120 },
		{ label: "周二", value: 80 },
		{ label: "周三", value: 160 },
	];

	it("整组以一句话提供同样信息，单根柱子不单独进读屏树", () => {
		render(<MiniBars data={data} />);
		const chart = screen.getByRole("img", {
			name: "周一 120，周二 80，周三 160",
		});
		expect(chart.querySelectorAll(".v-mini-bars__bar")).toHaveLength(3);
	});

	it("指针移上去才显示这一根的具体数", () => {
		const { container } = render(<MiniBars data={data} unit="访问" />);
		const items = container.querySelectorAll(".v-mini-bars__item");
		expect(container.querySelector(".v-mini-bars__tip")).toBeNull();
		fireEvent.pointerEnter(items[2] as HTMLElement);
		const tip = container.querySelector(".v-mini-bars__tip");
		expect(tip?.textContent).toContain("160");
		expect(tip?.textContent).toContain("周三 访问");
		expect(items[2]?.hasAttribute("data-active")).toBe(true);
		fireEvent.pointerLeave(items[2] as HTMLElement);
		expect(container.querySelector(".v-mini-bars__tip")).toBeNull();
	});

	it("可传入自定义数值格式与读屏摘要", () => {
		render(
			<MiniBars
				data={data}
				formatValue={(value) => `${value} 次`}
				summary="近三天访问先降后升"
			/>,
		);
		expect(screen.getByRole("img", { name: "近三天访问先降后升" })).toBeTruthy();
	});
});
