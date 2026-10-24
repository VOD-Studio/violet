import { scheduleEnhancement } from "@shared/lib/schedule-enhancement";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type RenderMermaidResult, renderMermaid } from "../render-mermaid";

const { initialize, render, loadFonts } = vi.hoisted(() => ({
	initialize: vi.fn(),
	render: vi.fn(),
	loadFonts: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: { initialize, render } }));
vi.mock("../sketch-fonts", () => ({
	DIAGRAM_FONT_FAMILY: "sans-serif",
	loadDiagramFonts: loadFonts,
}));
// jsdom 无 SVG 几何 API；标记最终笔触阶段，确保不提前交付普通 SVG。
vi.mock("@violetjs/inkline/dom", () => ({
	inkSvg: (svg: SVGSVGElement) => svg.setAttribute("data-ink-complete", "true"),
}));

function visibleHost() {
	const element = document.createElement("div");
	vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 20, 100, 100));
	document.body.append(element);
	return element;
}

function svgText(result: RenderMermaidResult) {
	if (!("svg" in result)) throw new Error(result.error);
	const document = new DOMParser().parseFromString(result.svg, "image/svg+xml");
	expect(document.documentElement.getAttribute("data-ink-complete")).toBe("true");
	expect(document.querySelector("script")).toBeNull();
	return document.documentElement.textContent;
}

beforeEach(() => {
	vi.useFakeTimers();
	initialize.mockReset();
	render.mockReset();
	loadFonts.mockReset();
	loadFonts.mockResolvedValue(undefined);
});

afterEach(async () => {
	await vi.runAllTimersAsync();
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("Mermaid 与可见增强的调度隔离", () => {
	it("内部 renderer 下载未完成时，可见增强仍提交结果，图表只交付完整手绘结果", async () => {
		const rendererDownload = Promise.withResolvers<void>();
		let diagram: RenderMermaidResult | undefined;
		render.mockImplementation(async () => {
			await rendererDownload.promise;
			return { svg: "<svg><text>完整图表</text><script>unsafe()</script></svg>" };
		});
		const pending = renderMermaid("flowchart TD; A-->B").then((result) => {
			diagram = result;
		});
		try {
			await vi.runAllTimersAsync();
			const code = visibleHost();
			const enhancement = scheduleEnhancement(
				() => {
					code.textContent = "高亮已就绪";
				},
				{ element: code },
			);
			await vi.runAllTimersAsync();
			expect(code.textContent).toBe("高亮已就绪");
			expect(diagram).toBeUndefined();
			await enhancement;
		} finally {
			rendererDownload.resolve();
			await vi.runAllTimersAsync();
			await pending;
		}
		if (!diagram) throw new Error("图表未交付结果");
		expect(svgText(diagram)).toBe("完整图表");
	});

	it("并发明暗图表的异步 render 不串源码或全局主题", async () => {
		const firstRender = Promise.withResolvers<void>();
		let activeTheme = "";
		initialize.mockImplementation((config: { theme: string }) => {
			activeTheme = config.theme;
		});
		render.mockImplementation(async (_id: string, source: string) => {
			if (source === "first") await firstRender.promise;
			return { svg: `<svg><text>${source}:${activeTheme}</text></svg>` };
		});
		const first = renderMermaid("first", "light");
		const second = renderMermaid("second", "dark");
		try {
			await vi.runAllTimersAsync();
			expect(activeTheme).toBe("base");
		} finally {
			firstRender.resolve();
			await vi.runAllTimersAsync();
		}
		expect(svgText(await first)).toBe("first:base");
		expect(svgText(await second)).toBe("second:dark");
	});

	it("取消运行中与排队图表立即结束等待，不阻塞其他增强或留下过期图表", async () => {
		const firstRender = Promise.withResolvers<void>();
		const runningController = new AbortController();
		const queuedController = new AbortController();
		const rendered: string[] = [];
		render.mockImplementation(async (_id: string, source: string) => {
			rendered.push(source);
			if (source === "running") await firstRender.promise;
			return { svg: `<svg><text>${source}</text></svg>` };
		});
		let runningResult: RenderMermaidResult | undefined;
		let queuedResult: RenderMermaidResult | undefined;
		const running = renderMermaid("running", "light", {
			signal: runningController.signal,
		}).then((result) => {
			runningResult = result;
		});
		const queued = renderMermaid("cancelled", "dark", {
			signal: queuedController.signal,
		}).then((result) => {
			queuedResult = result;
		});
		const next = renderMermaid("next", "dark");
		try {
			await vi.runAllTimersAsync();
			runningController.abort();
			queuedController.abort();
			const math = visibleHost();
			const enhancement = scheduleEnhancement(
				() => {
					math.textContent = "公式已就绪";
				},
				{ element: math },
			);
			await vi.runAllTimersAsync();
			expect(runningResult).toMatchObject({ cause: { name: "AbortError" } });
			expect(queuedResult).toMatchObject({ cause: { name: "AbortError" } });
			expect(math.textContent).toBe("公式已就绪");
			await enhancement;
		} finally {
			firstRender.resolve();
			await vi.runAllTimersAsync();
			await Promise.all([running, queued]);
		}
		expect(svgText(await next)).toBe("next");
		expect(rendered).toEqual(["running", "next"]);
	});

	it("局部 renderer 失败后其他图表和显式重试仍可得到完整结果", async () => {
		render.mockRejectedValueOnce(new Error("renderer download failed"));
		render.mockImplementation(async (_id: string, source: string) => ({
			svg: `<svg><text>${source}</text></svg>`,
		}));
		const failed = renderMermaid("retry");
		const other = renderMermaid("other");
		await vi.runAllTimersAsync();
		expect(await failed).toMatchObject({ error: "renderer download failed" });
		expect(svgText(await other)).toBe("other");
		const retry = renderMermaid("retry");
		await vi.runAllTimersAsync();
		expect(svgText(await retry)).toBe("retry");
	});

	it("字体准备期间取消立即返回，准备好的另一图表不等待该字体", async () => {
		const fonts = Promise.withResolvers<void>();
		const controller = new AbortController();
		loadFonts.mockImplementation((source: string) =>
			source === "waiting" ? fonts.promise : Promise.resolve(),
		);
		render.mockImplementation(async (_id: string, source: string) => ({
			svg: `<svg><text>${source}</text></svg>`,
		}));
		let cancelled: RenderMermaidResult | undefined;
		const waiting = renderMermaid("waiting", "light", { signal: controller.signal }).then(
			(result) => {
				cancelled = result;
			},
		);
		const ready = renderMermaid("ready");
		try {
			await vi.runAllTimersAsync();
			controller.abort();
			await vi.runAllTimersAsync();
			expect(cancelled).toMatchObject({ cause: { name: "AbortError" } });
			expect(svgText(await ready)).toBe("ready");
		} finally {
			fonts.resolve();
			await vi.runAllTimersAsync();
			await waiting;
		}
	});

	it("下载期间滚动进入视口的后续图表优先交付，不按原入队顺序占用渲染器", async () => {
		const download = Promise.withResolvers<void>();
		render.mockImplementation(async (_id: string, source: string) => {
			if (source === "first") await download.promise;
			return { svg: `<svg><text>${source}</text></svg>` };
		});
		const first = renderMermaid("first");
		await vi.runAllTimersAsync();
		const distantHost = visibleHost();
		const scrollingHost = visibleHost();
		vi.mocked(distantHost.getBoundingClientRect).mockReturnValue(
			new DOMRect(0, 5000, 100, 100),
		);
		vi.mocked(scrollingHost.getBoundingClientRect).mockReturnValue(
			new DOMRect(0, 6000, 100, 100),
		);
		const completed: string[] = [];
		const distant = renderMermaid("distant", "light", { element: distantHost }).then((result) =>
			completed.push(svgText(result) ?? ""),
		);
		const visible = renderMermaid("visible", "dark", { element: scrollingHost }).then(
			(result) => completed.push(svgText(result) ?? ""),
		);
		try {
			await vi.runAllTimersAsync();
			expect(completed).toEqual([]);
			vi.mocked(scrollingHost.getBoundingClientRect).mockReturnValue(
				new DOMRect(0, 20, 100, 100),
			);
		} finally {
			download.resolve();
			await vi.runAllTimersAsync();
			await Promise.all([first, distant, visible]);
		}
		expect(completed).toEqual(["visible", "distant"]);
	});

	it.each(["initialize", "render"] as const)("%s 同步抛错不会占住私有渲染器", async (stage) => {
		render.mockImplementation(async (_id: string, source: string) => ({
			svg: `<svg><text>${source}</text></svg>`,
		}));
		const failingStage = stage === "initialize" ? initialize : render;
		failingStage.mockImplementationOnce(() => {
			throw new Error("同步启动失败");
		});
		const failed = renderMermaid("failed");
		const next = renderMermaid("next");
		await vi.runAllTimersAsync();
		expect(await failed).toMatchObject({ error: "同步启动失败" });
		expect(svgText(await next)).toBe("next");
	});
});
