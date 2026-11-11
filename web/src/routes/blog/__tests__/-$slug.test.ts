import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
	fetchPostBySlug: vi.fn(),
	fetchAnnotationSummary: vi.fn(),
	fetchSettings: vi.fn(),
	fetchAnnouncements: vi.fn(),
	fetchChapterContext: vi.fn(),
	fetchSeriesBySlug: vi.fn(),
	fetchActivePersona: vi.fn(),
}));
vi.mock("@features/posts/api/queries", () => ({ fetchPostBySlug: queries.fetchPostBySlug }));
vi.mock("@features/comments/api/queries", () => ({
	fetchAnnotationSummary: queries.fetchAnnotationSummary,
}));
vi.mock("@features/settings/api/queries", () => ({
	fetchSettings: queries.fetchSettings,
	fetchAnnouncements: queries.fetchAnnouncements,
}));
vi.mock("@features/series/api/queries", () => ({
	fetchChapterContext: queries.fetchChapterContext,
	fetchSeriesBySlug: queries.fetchSeriesBySlug,
}));
vi.mock("@entities/persona/api/queries", () => ({
	fetchActivePersona: queries.fetchActivePersona,
}));
vi.mock("@widgets/BlogDetailPage", () => ({ BlogDetailPage: () => null }));

import { Route } from "../$slug";

type Loader = (args: {
	context: { queryClient: QueryClient };
	params: { slug: string };
}) => Promise<unknown>;

const POST = { id: "post-1", slug: "quan-bu" };
const SETTINGS = { comments_enabled: false };
const CHAPTER = { series: { slug: "shu" } };
const SERIES = { slug: "shu", title: "书" };
const PERSONA = { name: "紫罗兰" };
const ANNOUNCEMENTS = [{ id: 1, display: "banner" }];

async function runLoader() {
	const queryClient = new QueryClient();
	const post = await (Route.options.loader as Loader)({
		context: { queryClient },
		params: { slug: "quan-bu" },
	});
	// 预取不被 await，让出一轮微任务后再断言
	await Promise.resolve();
	const cached = {
		settings: queryClient.getQueryData(["settings", "public"]),
		announcements: queryClient.getQueryData(["settings", "announcements"]),
		chapter: queryClient.getQueryData(["series", "context", "quan-bu"]),
		seriesDetail: queryClient.getQueryData(["series", "detail", "shu"]),
		persona: queryClient.getQueryData(["active-persona", "current", ""]),
	};
	await queryClient.cancelQueries();
	return { post, cached };
}

beforeEach(() => {
	queries.fetchPostBySlug.mockResolvedValue(POST);
	queries.fetchAnnotationSummary.mockResolvedValue([]);
	queries.fetchSettings.mockResolvedValue(SETTINGS);
	queries.fetchAnnouncements.mockResolvedValue(ANNOUNCEMENTS);
	queries.fetchChapterContext.mockResolvedValue(CHAPTER);
	queries.fetchSeriesBySlug.mockResolvedValue(SERIES);
	queries.fetchActivePersona.mockResolvedValue(PERSONA);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("文章页 loader 的批注摘要预取", () => {
	it("服务端渲染时不预取：服务端没有访客身份，只会得到一份空表并当作新鲜数据交给浏览器", async () => {
		vi.stubGlobal("window", undefined);
		await runLoader();
		expect(queries.fetchAnnotationSummary).not.toHaveBeenCalled();
	});

	it("浏览器里导航时照常预取", async () => {
		await runLoader();
		expect(queries.fetchAnnotationSummary).toHaveBeenCalledWith("post-1");
	});
});

describe("文章页 loader 的阅读页公共数据", () => {
	it("服务端渲染时站点设置、系列归属、人设与公告随正文一起交给浏览器", async () => {
		vi.stubGlobal("window", undefined);
		const { post, cached } = await runLoader();
		expect(post).toEqual(POST);
		expect(cached).toEqual({
			settings: SETTINGS,
			announcements: ANNOUNCEMENTS,
			chapter: CHAPTER,
			seriesDetail: SERIES,
			persona: PERSONA,
		});
		expect(queries.fetchChapterContext).toHaveBeenCalledWith("quan-bu");
		expect(queries.fetchSeriesBySlug).toHaveBeenCalledWith("shu");
	});

	it("公共数据取不到时正文照常交付，缺的部分留给浏览器重取", async () => {
		vi.stubGlobal("window", undefined);
		queries.fetchSettings.mockRejectedValue(new Error("settings down"));
		queries.fetchChapterContext.mockRejectedValue(new Error("series down"));
		const { post, cached } = await runLoader();
		expect(post).toEqual(POST);
		expect(cached).toEqual({
			settings: undefined,
			announcements: ANNOUNCEMENTS,
			chapter: undefined,
			seriesDetail: undefined,
			persona: PERSONA,
		});
		// 服务端不为公共数据重试，重试的等待会算进首字节时间
		expect(queries.fetchSettings).toHaveBeenCalledTimes(1);
	});

	it("浏览器里导航时公共数据同步发起，但不拖住页面切换", async () => {
		queries.fetchChapterContext.mockReturnValue(Promise.withResolvers().promise);
		const { post } = await runLoader();
		expect(post).toEqual(POST);
		expect(queries.fetchChapterContext).toHaveBeenCalledWith("quan-bu");
	});
});
