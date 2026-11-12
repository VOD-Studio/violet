import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NavbarBrand, type NavbarBrandProps } from "../NavbarBrand";

const slot = (container: HTMLElement, name: string) =>
	container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

/** 药丸的外层带 `group` 与导航栏的 `data-collapsed`，与真实装配一致。 */
function setup(props: Partial<NavbarBrandProps> = {}, collapsed = false) {
	return render(
		<div className="group/navbar" data-collapsed={collapsed}>
			<div className="group">
				<NavbarBrand name="Violet" {...props} />
			</div>
		</div>,
	);
}

describe("NavbarBrand", () => {
	afterEach(cleanup);

	it("没有 live：显示站名字标，没有两行文字", () => {
		setup();
		expect(screen.getByText("Violet")).toBeTruthy();
		expect(slot(document.body, "brand-lines")).toBeNull();
	});

	it("有 lines：字标让位，两行文字出现", () => {
		setup({ live: { lines: { primary: "晴天", secondary: "周杰伦" } } });
		expect(screen.queryByText("Violet")).toBeNull();
		expect(screen.getByText("晴天")).toBeTruthy();
		expect(screen.getByText("周杰伦")).toBeTruthy();
	});

	it("封面圆与应用圆无 src 时仍占位，数量不随数据变化", () => {
		const { container, rerender } = setup({ live: { cover: {}, app: {} } });
		expect(slot(container, "brand-cover")).toBeTruthy();
		expect(slot(container, "brand-app")).toBeTruthy();
		expect(container.querySelectorAll("img")).toHaveLength(0);

		rerender(
			<div className="group/navbar" data-collapsed="false">
				<div className="group">
					<NavbarBrand
						name="Violet"
						live={{ cover: { src: "/c.png" }, app: { src: "/a.png" } }}
					/>
				</div>
			</div>,
		);
		expect(container.querySelectorAll("img")).toHaveLength(2);
		expect(slot(container, "brand-cover")?.querySelector("img")?.getAttribute("src")).toBe(
			"/c.png",
		);
		expect(slot(container, "brand-app")?.querySelector("img")?.getAttribute("src")).toBe(
			"/a.png",
		);
	});

	it("没有封面或应用时不画对应的圆", () => {
		const { container } = setup({ live: { playing: true } });
		expect(slot(container, "brand-cover")).toBeNull();
		expect(slot(container, "brand-app")).toBeNull();
	});

	it("封面暂停：只有封面圆灰化变淡", () => {
		const { container } = setup({
			live: { cover: { src: "/c.png", paused: true }, app: { src: "/a.png" } },
		});
		const cover = slot(container, "brand-cover");
		expect(cover?.className).toContain("grayscale");
		expect(cover?.className).toContain("opacity-60");
		expect(slot(container, "brand-app")?.className).not.toContain("grayscale");
		expect(slot(container, "brand-avatar")?.className).not.toContain("grayscale");
	});

	it("封面未暂停不灰化", () => {
		const { container } = setup({ live: { cover: { src: "/c.png" } } });
		expect(slot(container, "brand-cover")?.className).not.toContain("grayscale");
	});

	it("playing 才有均衡器，三根柱", () => {
		const { container, rerender } = setup({ live: { playing: false } });
		expect(slot(container, "brand-equalizer")).toBeNull();
		rerender(
			<div className="group/navbar" data-collapsed="false">
				<div className="group">
					<NavbarBrand name="Violet" live={{ playing: true }} />
				</div>
			</div>,
		);
		expect(slot(container, "brand-equalizer")?.children).toHaveLength(3);
	});

	it("收起态：头像与叠圆仍在，文字、均衡器与箭头折叠到收起容器里", () => {
		const { container } = setup(
			{
				live: {
					cover: { src: "/c.png" },
					app: {},
					playing: true,
					lines: { primary: "晴天" },
				},
			},
			true,
		);
		expect(slot(container, "brand-avatar")).toBeTruthy();
		expect(slot(container, "brand-cover")).toBeTruthy();
		expect(slot(container, "brand-app")).toBeTruthy();
		const folded = screen.getByText("晴天").closest<HTMLElement>('[data-slot="brand-label"]');
		expect(folded?.className).toContain("group-data-[collapsed=true]/navbar:max-w-0");
		expect(folded?.contains(slot(container, "brand-equalizer"))).toBe(true);
		for (const circle of ["brand-avatar", "brand-cover", "brand-app"]) {
			expect(folded?.contains(slot(container, circle))).toBe(false);
		}
	});

	it("箭头只在 open 时朝上", () => {
		const { container, rerender } = setup();
		expect(slot(container, "brand-chevron")?.getAttribute("class")).not.toContain("rotate-180");
		rerender(
			<div className="group/navbar" data-collapsed="false">
				<div className="group">
					<NavbarBrand name="Violet" open />
				</div>
			</div>,
		);
		expect(slot(container, "brand-chevron")?.getAttribute("class")).toContain("rotate-180");
	});

	it("头像有地址时是 img，无地址时给默认标记", () => {
		const { container, rerender } = setup();
		expect(slot(container, "brand-avatar")?.querySelector("img")).toBeNull();
		expect(slot(container, "brand-avatar")?.querySelector("svg")).toBeTruthy();
		rerender(
			<div className="group/navbar" data-collapsed="false">
				<div className="group">
					<NavbarBrand name="Violet" avatar="/me.png" />
				</div>
			</div>,
		);
		expect(slot(container, "brand-avatar")?.querySelector("img")?.getAttribute("src")).toBe(
			"/me.png",
		);
	});
});
