import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserProfileFeed, type UserProfileFeedProps } from "../UserProfileFeed";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

afterEach(cleanup);

const base: UserProfileFeedProps = {
	tweets: [],
	isLoading: false,
	error: null,
	hasNextPage: false,
	isFetchingNextPage: false,
	onLoadMore: () => {},
	isSelf: false,
};

describe("UserProfileFeed", () => {
	it("本人没有推文时给出发布入口，访客只看到说明", () => {
		const { rerender } = render(<UserProfileFeed {...base} isSelf />);
		expect(screen.getByRole("link", { name: "去发布" }).getAttribute("href")).toBe("/tweets");
		rerender(<UserProfileFeed {...base} />);
		expect(screen.queryByRole("link", { name: "去发布" })).toBeNull();
		expect(screen.getByText("这位用户还没有发布推文。")).toBeTruthy();
	});

	it("图文视图为空但还有下一页时，可以继续加载", () => {
		const onLoadMore = vi.fn();
		render(<UserProfileFeed {...base} hasNextPage onLoadMore={onLoadMore} />);
		fireEvent.click(screen.getByRole("button", { name: /图文/ }));
		expect(screen.getByText("还没有图文推文")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "继续加载" }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});

	it("加载失败时显示错误说明，不显示空状态", () => {
		render(<UserProfileFeed {...base} error={new Error("网络不可用")} />);
		expect(screen.getByText("加载失败")).toBeTruthy();
		expect(screen.getByText("网络不可用")).toBeTruthy();
		expect(screen.queryByText("还没有推文")).toBeNull();
	});
});
