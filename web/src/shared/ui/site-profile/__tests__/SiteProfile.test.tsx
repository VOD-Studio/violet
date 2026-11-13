import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteProfile, type SiteProfileProps } from "../SiteProfile";

function PlainLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return (
		<a
			href={href}
			{...props}
			onClick={(event) => {
				props.onClick?.(event);
				event.preventDefault();
			}}
		/>
	);
}

const LABEL = "Violet 站长档案，此刻正在播放 晴天";

function setup(props: Partial<SiteProfileProps> = {}) {
	return render(
		<SiteProfile
			label={LABEL}
			brand={{
				name: "Violet",
				live: {
					cover: { src: "/c.png" },
					playing: true,
					lines: { primary: "晴天", secondary: "周杰伦" },
				},
			}}
			card={{
				identity: { name: "xunrua" },
				year: { year: 2026, dayOfYear: 304, daysLeft: 61, month: 9 },
				now: {
					deviceName: "MacBook Pro",
					media: { sourceLabel: "正在播放", title: "晴天" },
				},
			}}
			LinkComponent={PlainLink}
			{...props}
		/>,
	);
}

const pill = () => screen.getByRole("button", { name: LABEL });
const panel = () => screen.queryByRole("dialog", { name: "站长与此刻" });

describe("SiteProfile", () => {
	afterEach(cleanup);

	it("收起时只有药丸：以 label 命名、未展开，药丸里显示此刻的两行文字", () => {
		setup();
		expect(pill().getAttribute("aria-expanded")).toBe("false");
		expect(panel()).toBeNull();
		expect(pill().textContent).toContain("晴天");
	});

	it("点药丸展开成名为「站长与此刻」的 dialog，卡片内容在里面", () => {
		setup();
		fireEvent.click(pill());
		const dialog = screen.getByRole("dialog", { name: "站长与此刻" });
		expect(pill().getAttribute("aria-expanded")).toBe("true");
		expect(dialog.textContent).toContain("xunrua");
		expect(dialog.textContent).toContain("MacBook Pro");
	});

	it("站名字标与姓名不同时，药丸和卡片缺图都显示站长姓名首字", () => {
		setup();
		expect(pill().querySelector('[data-slot="brand-avatar"]')?.textContent).toBe("X");
		fireEvent.click(pill());
		const dialog = screen.getByRole("dialog", { name: "站长与此刻" });
		expect(dialog.querySelector('[data-slot="profile-avatar"]')?.textContent).toBe("X");
	});

	it("Esc 收起，焦点回到药丸", async () => {
		setup();
		fireEvent.click(pill());
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		expect(pill().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(pill());
	});

	it("再点药丸原位收起，焦点回到药丸", async () => {
		setup();
		fireEvent.click(pill());
		fireEvent.click(pill());
		expect(pill().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(pill());
	});

	it("点卡片里的链接收起卡片", async () => {
		setup();
		fireEvent.click(pill());
		const link = screen.getByRole("link", { name: "友链" });
		await act(async () => fireEvent.click(link));
		expect(pill().getAttribute("aria-expanded")).toBe("false");
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("受控：开合交给 open 与 onOpenChange", () => {
		const onOpenChange = vi.fn();
		const { rerender } = setup({ open: false, onOpenChange });
		fireEvent.click(pill());
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(panel()).toBeNull();
		rerender(
			<SiteProfile
				label={LABEL}
				brand={{ name: "Violet" }}
				card={{
					identity: { name: "xunrua" },
					year: { year: 2026, dayOfYear: 304, daysLeft: 61, month: 9 },
				}}
				open
				LinkComponent={PlainLink}
			/>,
		);
		expect(panel()).not.toBeNull();
	});
});
