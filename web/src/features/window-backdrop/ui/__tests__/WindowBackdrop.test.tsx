import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WindowBackdrop } from "../WindowBackdrop";

const requests = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("@shared/api/request", () => requests);

let client: QueryClient;

const state = {
	enabled: true,
	city: "杭州",
	timezone: "Asia/Shanghai",
	condition: "rain",
	is_day: false,
	temperature_c: 12.4,
	observed_at: "2026-11-04T13:30:00Z",
	photo_slot: "night",
	photo: "",
};

function renderBackdrop(listening: string | null = null) {
	return render(
		<QueryClientProvider client={client}>
			<main>
				<div data-testid="gap" style={{ height: 40 }} />
				<p data-testid="text">正文</p>
			</main>
			<WindowBackdrop dense listening={listening} />
		</QueryClientProvider>,
	);
}

const press = (el: Element, x = 10, y = 10) =>
	act(() => {
		el.dispatchEvent(
			new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: x, clientY: y }),
		);
	});

beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	requests.apiGet.mockResolvedValue(state);
	requests.apiPost.mockResolvedValue(null);
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

it("连点两下空白处是敲窗：通知站长并显示他那边的天气与在听的歌", async () => {
	renderBackdrop("正在听《夜航星》 · 不才");
	await waitFor(() => expect(requests.apiGet).toHaveBeenCalledWith("/window"));
	const gap = screen.getByTestId("gap");
	press(gap);
	press(gap, 14, 12);

	await waitFor(() =>
		expect(requests.apiPost).toHaveBeenCalledWith("/window/knock", { page: "/" }),
	);
	const card = await screen.findByRole("status");
	expect(card.textContent).toContain("你敲了敲窗");
	expect(card.textContent).toContain("杭州，下雨 12°");
	expect(card.textContent).toContain("正在听《夜航星》 · 不才");
});

it("单击、离得远的两下、按在文字上都不算敲窗", async () => {
	renderBackdrop();
	await waitFor(() => expect(requests.apiGet).toHaveBeenCalled());
	press(screen.getByTestId("gap"));
	press(screen.getByTestId("gap"), 200, 200);
	press(screen.getByTestId("text"));
	press(screen.getByTestId("text"));
	await new Promise((r) => setTimeout(r, 20));
	expect(requests.apiPost).not.toHaveBeenCalled();
	expect(screen.queryByRole("status")).toBeNull();
});

it("未配置城市时卡片说明窗外是默认的景", async () => {
	requests.apiGet.mockResolvedValue({
		...state,
		enabled: false,
		city: "",
		timezone: "",
		condition: "",
	});
	renderBackdrop();
	await waitFor(() => expect(requests.apiGet).toHaveBeenCalled());
	const gap = screen.getByTestId("gap");
	press(gap);
	press(gap);
	expect((await screen.findByRole("status")).textContent).toContain(
		"站长还没告诉窗外是哪座城市。",
	);
});
