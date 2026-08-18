import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useRepos = vi.fn();
vi.mock("../../api/queries", () => ({
	useRepos: () => useRepos(),
}));

import RepoList from "../RepoList";

describe("RepoList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("当 data 为 null 时不抛出 TypeError，渲染空数据提示", () => {
		useRepos.mockReturnValue({ data: null, isLoading: false, isError: false });
		render(<RepoList />);

		expect(screen.getByText("NO REPOS")).toBeTruthy();
		expect(screen.getByText("暂无仓库数据")).toBeTruthy();
	});

	it("当 data 为空数组时渲染空数据提示", () => {
		useRepos.mockReturnValue({ data: [], isLoading: false, isError: false });
		render(<RepoList />);

		expect(screen.getByText("NO REPOS")).toBeTruthy();
	});

	it("加载态时渲染骨架", () => {
		useRepos.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		const { container } = render(<RepoList />);
		expect(container.querySelectorAll('[data-slot="shimmer-skeleton"]').length).toBeGreaterThan(
			0,
		);
	});

	it("错误态时渲染错误提示", () => {
		useRepos.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error("网络错误"),
		});
		render(<RepoList />);

		expect(screen.getByText("REPOS UNAVAILABLE")).toBeTruthy();
		expect(screen.getByText("网络错误")).toBeTruthy();
	});

	it("正常数据时渲染仓库列表且 pinned 优先排在前面", () => {
		useRepos.mockReturnValue({
			data: [
				{
					name: "repo-normal",
					description: "普通仓库",
					stars: 5,
					forks: 1,
					pinned: false,
					url: "https://github.com/test/repo-normal",
				},
				{
					name: "repo-pinned",
					description: "置顶仓库",
					stars: 10,
					forks: 2,
					pinned: true,
					url: "https://github.com/test/repo-pinned",
				},
			],
			isLoading: false,
			isError: false,
		});
		render(<RepoList />);

		expect(screen.getByText("repo-pinned")).toBeTruthy();
		expect(screen.getByText("repo-normal")).toBeTruthy();
		expect(screen.getByText("Pinned")).toBeTruthy();

		// 验证置顶排在第一个
		const headings = screen.getAllByRole("heading", { level: 3 });
		expect(headings[0]?.textContent).toBe("repo-pinned");
		expect(headings[1]?.textContent).toBe("repo-normal");
	});
});
