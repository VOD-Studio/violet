import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnouncementBar } from "../announcement-bar";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("AnnouncementBar", () => {
	it("渲染一句话正文与关闭钮，没有链接时不出现链接", () => {
		render(<AnnouncementBar content="评论编辑器即将支持 Markdown 实时预览" onClose={() => {}} />);
		expect(screen.getByText("评论编辑器即将支持 Markdown 实时预览")).toBeTruthy();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByRole("button", { name: "关闭公告" })).toBeTruthy();
	});

	it("传了链接就用原生 a 并保留 href", () => {
		render(
			<AnnouncementBar
				content="站点将于周日凌晨维护"
				link={{ href: "/announcements/12", label: "查看详情" }}
				onClose={() => {}}
			/>,
		);
		const link = screen.getByRole("link", { name: "查看详情" });
		expect(link.getAttribute("href")).toBe("/announcements/12");
	});

	it("关闭钮触发 onClose，语气写在 data-severity 上", () => {
		const onClose = vi.fn();
		const { container } = render(
			<AnnouncementBar content="同步失败，稍后重试" severity="error" onClose={onClose} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "关闭公告" }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(container.querySelector(".v-announcement-bar")?.getAttribute("data-severity")).toBe(
			"error",
		);
	});

	it("减弱动态下不丢内容：正文、链接与关闭钮都还在", () => {
		vi.stubGlobal("matchMedia", () => ({
			media: "(prefers-reduced-motion: reduce)",
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {},
		}));
		render(
			<AnnouncementBar
				content="站点将于周日凌晨维护"
				link={{ href: "/announcements/12", label: "查看详情" }}
				onClose={() => {}}
			/>,
		);
		expect(screen.getByText("站点将于周日凌晨维护")).toBeTruthy();
		expect(screen.getByRole("link", { name: "查看详情" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "关闭公告" })).toBeTruthy();
	});
});