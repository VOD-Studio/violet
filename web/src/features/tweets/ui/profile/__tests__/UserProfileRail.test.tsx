import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileActivity } from "../../../model/profile-activity";
import { UserProfileLayout } from "../UserProfileLayout";
import { UserProfileRail } from "../UserProfileRail";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...props
	}: {
		to: string;
		params?: Record<string, string>;
		children?: ReactNode;
	} & AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={params ? to.replace("$tag", params.tag) : to} {...props}>
			{children}
		</a>
	),
}));

afterEach(cleanup);

const activity: ProfileActivity = {
	latestAt: new Date().toISOString(),
	recentCount: 5,
	likeCount: 42,
	topics: [
		{ tag: "摄影", count: 3 },
		{ tag: "旅行", count: 1 },
	],
	partial: false,
};

describe("UserProfileRail", () => {
	it("展示动态概览与话题链接", () => {
		render(<UserProfileRail activity={activity} />);
		expect(screen.getByText("最近发文")).toBeTruthy();
		expect(screen.getByText("5 条")).toBeTruthy();
		expect(screen.getByText("42")).toBeTruthy();
		const topic = screen.getByRole("link", { name: /#摄影/ });
		expect(topic.getAttribute("href")).toBe("/tweets/topics/摄影");
	});

	it("还有未加载的推文时数字标为下限", () => {
		render(<UserProfileRail activity={{ ...activity, partial: true }} />);
		expect(screen.getByText("5+ 条")).toBeTruthy();
		expect(screen.getByText("42+")).toBeTruthy();
	});

	it("没有话题时不渲染常用话题分区", () => {
		render(<UserProfileRail activity={{ ...activity, topics: [] }} />);
		expect(screen.queryByText("常用话题")).toBeNull();
		expect(screen.getByText("动态概览")).toBeTruthy();
	});
});

describe("UserProfileLayout", () => {
	it("提供概览栏时三栏并排，没有时收起这一栏", () => {
		const { container, rerender } = render(
			<UserProfileLayout panel={<p>资料</p>} main={<p>内容</p>} rail={<p>概览</p>} />,
		);
		expect(screen.getByText("概览")).toBeTruthy();
		expect(
			container.querySelector(".xl\\:grid-cols-\\[17rem_minmax\\(0\\,1fr\\)_16rem\\]"),
		).not.toBeNull();
		rerender(<UserProfileLayout panel={<p>资料</p>} main={<p>内容</p>} />);
		expect(screen.queryByText("概览")).toBeNull();
		expect(
			container.querySelector(".xl\\:grid-cols-\\[17rem_minmax\\(0\\,1fr\\)_16rem\\]"),
		).toBeNull();
		expect(screen.getByRole("complementary")).toBeTruthy();
		expect(screen.getByRole("main")).toBeTruthy();
	});
});
