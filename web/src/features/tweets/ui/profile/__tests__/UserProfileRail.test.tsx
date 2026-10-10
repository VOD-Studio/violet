import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ActivityGrid,
	buildActivityGrid,
	type ProfileActivity,
} from "../../../model/profile-activity";
import { UserProfileCover } from "../UserProfileCover";
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

const grid: ActivityGrid = buildActivityGrid(
	[
		{
			id: "t",
			author: { id: "u", username: "u", avatar_url: "" },
			content: "",
			images: [],
			like_count: 0,
			comment_count: 0,
			quote_count: 0,
			is_liked: false,
			created_at: new Date().toISOString(),
		},
	],
	new Date(),
);

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
		render(<UserProfileRail activity={activity} grid={grid} />);
		expect(screen.getByText("最近发文")).toBeTruthy();
		expect(screen.getByText("5 条")).toBeTruthy();
		const topic = screen.getByRole("link", { name: /#摄影/ });
		expect(topic.getAttribute("href")).toBe("/tweets/topics/摄影");
	});

	it("还有未加载的推文时数字标为下限", () => {
		render(<UserProfileRail activity={{ ...activity, partial: true }} grid={grid} />);
		expect(screen.getByText("5+ 条")).toBeTruthy();
	});

	it("热力图展示近 12 周，带可读的整体说明与按天的提示", () => {
		render(<UserProfileRail activity={activity} grid={grid} />);
		const map = screen.getByRole("img", { name: "近 12 周共发布 1 条推文" });
		expect(map.children).toHaveLength(84);
		expect(map.querySelectorAll("[title$='1 条']")).toHaveLength(1);
		expect(screen.getByText("每格一天")).toBeTruthy();
	});

	it("还有未加载推文时热力图标明只含已加载部分", () => {
		render(<UserProfileRail activity={{ ...activity, partial: true }} grid={grid} />);
		expect(screen.getByText("仅含已加载的推文")).toBeTruthy();
		expect(screen.getByText("1+ 条")).toBeTruthy();
	});

	it("没有话题时不渲染常用话题分区", () => {
		render(<UserProfileRail activity={{ ...activity, topics: [] }} grid={grid} />);
		expect(screen.queryByText("常用话题")).toBeNull();
		expect(screen.getByText("动态概览")).toBeTruthy();
	});
});

describe("UserProfileCover", () => {
	it("有底图时渲染模糊底图，且整体对辅助技术隐藏", () => {
		const { container } = render(<UserProfileCover imageSrc="/a.png" />);
		expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
		expect(container.querySelector("img")?.getAttribute("src")).toBe("/a.png");
	});

	it("没有底图时只保留底色", () => {
		const { container } = render(<UserProfileCover />);
		expect(container.querySelector("img")).toBeNull();
	});
});

describe("UserProfileLayout", () => {
	it("提供概览栏时三栏并排，没有时收起这一栏", () => {
		const { container, rerender } = render(
			<UserProfileLayout
				cover={<div />}
				panel={<p>资料</p>}
				main={<p>内容</p>}
				rail={<p>概览</p>}
			/>,
		);
		expect(screen.getByText("概览")).toBeTruthy();
		expect(
			container.querySelector(".xl\\:grid-cols-\\[17rem_minmax\\(0\\,1fr\\)_16rem\\]"),
		).not.toBeNull();
		rerender(<UserProfileLayout cover={<div />} panel={<p>资料</p>} main={<p>内容</p>} />);
		expect(screen.queryByText("概览")).toBeNull();
		expect(
			container.querySelector(".xl\\:grid-cols-\\[17rem_minmax\\(0\\,1fr\\)_16rem\\]"),
		).toBeNull();
		// 资料栏要压在带定位的封面上，必须有自己的层级。
		expect(screen.getByRole("complementary").className).toContain("z-10");
		expect(screen.getByRole("main")).toBeTruthy();
	});
});
