import type { SiteIdentity } from "@entities/site-identity/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSiteImpression, leaveSiteImpression } from "./api/client";
import { HomeClosing } from "./HomeClosing";
import type { SiteImpressionState } from "./types";

vi.mock("./api/client", () => ({
	fetchSiteImpression: vi.fn(),
	leaveSiteImpression: vi.fn(),
}));
vi.mock("@shared/api/csrf", () => ({ getCSRFToken: () => "csrf" }));
vi.mock("@features/seasonal-decor/ui/ClosingVignette", () => ({
	ClosingVignette: () => null,
}));
vi.mock("motion/react", () => ({
	motion: {
		div: ({ children, className }: ComponentProps<"div">) => (
			<div className={className}>{children}</div>
		),
	},
}));

const identity: SiteIdentity = {
	site_name: "Violet",
	site_url: "https://example.com",
	owner_name: "站长",
	bio: "",
	avatar_url: "",
	location: "",
	hero: { banner_url: null, quote: "", quote_translation: "", quote_author: "" },
	social_links: [],
	subscription_channels: [],
	home: { footprint_enabled: false, footprint_aggregation_days: 7 },
};

function renderClosing() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<HomeClosing identity={identity} season="spring" />
		</QueryClientProvider>,
	);
}

describe("首页匿名印记反馈", () => {
	beforeEach(() => {
		vi.mocked(fetchSiteImpression).mockResolvedValue({ count: 3, impressed: false });
	});

	afterEach(() => {
		cleanup();
		vi.resetAllMocks();
	});

	it("已留下印记再次激活不重复请求或累计", async () => {
		vi.mocked(fetchSiteImpression).mockResolvedValue({ count: 3, impressed: true });
		renderClosing();
		const button = screen.getByRole("button");
		await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
		fireEvent.click(button);
		fireEvent.click(button);
		expect(leaveSiteImpression).not.toHaveBeenCalled();
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("提交期间拦截重复激活，只在服务端确认后播放成功反馈", async () => {
		const { promise, resolve: resolveSubmission } =
			Promise.withResolvers<SiteImpressionState>();
		vi.mocked(leaveSiteImpression).mockReturnValue(promise);
		renderClosing();
		const button = screen.getByRole("button");
		await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
		fireEvent.click(button);
		fireEvent.click(button);
		await waitFor(() => expect(leaveSiteImpression).toHaveBeenCalledTimes(1));
		expect(button.getAttribute("aria-pressed")).toBe("false");
		resolveSubmission({ count: 4, impressed: true });
		await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
		expect(screen.getByText("4")).toBeTruthy();
		fireEvent.click(button);
		expect(leaveSiteImpression).toHaveBeenCalledTimes(1);
	});

	it("读取失败仍能登记，提交失败保持未选中并允许重试", async () => {
		vi.mocked(fetchSiteImpression).mockRejectedValue(new Error("读取失败"));
		vi.mocked(leaveSiteImpression)
			.mockRejectedValueOnce(new Error("提交失败"))
			.mockResolvedValueOnce({ count: 4, impressed: true });
		renderClosing();
		const button = screen.getByRole("button");
		await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
		fireEvent.click(button);
		await screen.findByRole("button", { name: /重试/ });
		expect(button.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(button);
		await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
		expect(leaveSiteImpression).toHaveBeenCalledTimes(2);
	});
});
