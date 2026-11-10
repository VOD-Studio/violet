import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
	fetchPostBySlug: vi.fn(),
	fetchAnnotationSummary: vi.fn(),
}));
vi.mock("@features/posts/api/queries", () => ({ fetchPostBySlug: queries.fetchPostBySlug }));
vi.mock("@features/comments/api/queries", () => ({
	fetchAnnotationSummary: queries.fetchAnnotationSummary,
}));
vi.mock("@widgets/BlogDetailPage", () => ({ BlogDetailPage: () => null }));

import { Route } from "../$slug";

type Loader = (args: {
	context: { queryClient: QueryClient };
	params: { slug: string };
}) => Promise<unknown>;

async function runLoader() {
	const queryClient = new QueryClient();
	await (Route.options.loader as Loader)({
		context: { queryClient },
		params: { slug: "quan-bu" },
	});
	// 预取不被 await，让出一轮微任务后再断言
	await Promise.resolve();
	await queryClient.cancelQueries();
}

beforeEach(() => {
	queries.fetchPostBySlug.mockResolvedValue({ id: "post-1", slug: "quan-bu" });
	queries.fetchAnnotationSummary.mockResolvedValue([]);
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
