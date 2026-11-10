import type { Announcement } from "@features/settings/model/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnnouncementBar from "../AnnouncementBar";

const feed = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock("@features/settings/api/queries", () => ({
	useAnnouncements: () => ({ data: feed.data }),
}));

const banner = (id: number, content: string, extra: Partial<Announcement> = {}): Announcement => ({
	id,
	title: content,
	content,
	severity: "info",
	display: "banner",
	created_at: "2026-11-01T00:00:00Z",
	...extra,
});

const readIds = (): number[] => JSON.parse(localStorage.getItem("announcement:read-ids") ?? "[]");

// rAF 由用例手动喂帧：轮换按累计时间推进，测试不必真等 6 秒
let frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let clock = 0;
const FRAME_MS = 16;

/** 推进若干帧，再等轮换的淡出提交完成 */
async function advance(ms: number) {
	await act(async () => {
		for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
			clock += FRAME_MS;
			const callbacks = [...frames.values()];
			frames.clear();
			for (const callback of callbacks) callback(clock);
		}
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 200));
	});
}

const dismiss = async () => {
	fireEvent.click(screen.getByRole("button", { name: "关闭公告" }));
	await new Promise((resolve) => setTimeout(resolve, 200));
};

beforeEach(() => {
	localStorage.clear();
	feed.data = [banner(7, "周日凌晨维护")];
	frames = new Map();
	nextFrameId = 1;
	clock = 0;
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
	vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("AnnouncementBar", () => {
	it("把公告渲染成导航下方的浮条，带关闭钮", () => {
		render(<AnnouncementBar />);
		expect(screen.getByText("周日凌晨维护")).toBeTruthy();
		expect(screen.getByRole("button", { name: "关闭公告" })).toBeTruthy();
	});

	it("没有链接字段时不渲染链接，有值时渲染", () => {
		const { rerender } = render(<AnnouncementBar />);
		expect(screen.queryByRole("link")).toBeNull();

		feed.data = [
			banner(7, "周日凌晨维护", { link_url: "/announcements/7", link_text: "查看" }),
		];
		rerender(<AnnouncementBar />);
		expect(screen.getByRole("link", { name: "查看" }).getAttribute("href")).toBe(
			"/announcements/7",
		);
	});

	it("关闭后记已读并整条消失", async () => {
		render(<AnnouncementBar />);
		await dismiss();
		expect(readIds()).toEqual([7]);
		expect(screen.queryByText("周日凌晨维护")).toBeNull();
	});

	it("已读的 id 不再出现，新 id 出现才重现", async () => {
		feed.data = [banner(7, "旧公告"), banner(8, "新公告")];
		const { rerender } = render(<AnnouncementBar />);
		expect(screen.getByText("旧公告")).toBeTruthy();

		await dismiss();
		expect(readIds().sort()).toEqual([7, 8]);
		expect(screen.queryByText("新公告")).toBeNull();

		feed.data = [banner(7, "旧公告"), banner(8, "新公告"), banner(9, "更新的公告")];
		rerender(<AnnouncementBar />);
		expect(screen.getByText("更新的公告")).toBeTruthy();
	});

	it("多条公告按驻留时长轮换", async () => {
		feed.data = [banner(7, "第一条"), banner(8, "第二条")];
		render(<AnnouncementBar />);
		expect(screen.getByText("第一条")).toBeTruthy();

		await advance(6200);
		expect(screen.getByText("第二条")).toBeTruthy();
	});

	it("悬停与聚焦时暂停轮换", async () => {
		feed.data = [banner(7, "第一条"), banner(8, "第二条")];
		const { container } = render(<AnnouncementBar />);
		const layer = container.firstElementChild as HTMLElement;

		fireEvent.mouseOver(layer);
		await advance(20000);
		expect(screen.queryByText("第二条")).toBeNull();

		fireEvent.mouseOut(layer);
		fireEvent.focus(screen.getByRole("button", { name: "关闭公告" }));
		await advance(20000);
		expect(screen.queryByText("第二条")).toBeNull();
	});

	it("减弱动态下不轮换，内容与关闭钮都在", async () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		}));
		feed.data = [banner(7, "第一条"), banner(8, "第二条")];
		render(<AnnouncementBar />);

		await advance(20000);
		expect(screen.getByText("第一条")).toBeTruthy();
		expect(screen.queryByText("第二条")).toBeNull();

		await dismiss();
		expect(readIds()).toEqual([7, 8]);
	});
});
