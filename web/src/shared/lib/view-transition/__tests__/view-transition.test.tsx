import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	markSharedSource,
	matchesAny,
	matchPattern,
	NoSharedElements,
	reconcileIntent,
	resolveTransitionKind,
	resolveViewTransitionTypes,
	SharedElement,
	useSharedIntent,
} from "../index";

const BLOG = ["/blog", "/blog/$slug"];

beforeEach(() => useSharedIntent.getState().clear());
afterEach(cleanup);

describe("matchPattern", () => {
	it("$param 匹配恰好一段，尾部 /* 匹配前缀及其下任意深度", () => {
		expect(matchPattern("/blog/$slug", "/blog/hello")).toBe(true);
		expect(matchPattern("/blog/$slug", "/blog")).toBe(false);
		expect(matchPattern("/blog/$slug", "/blog/a/b")).toBe(false);
		expect(matchPattern("/blog", "/blog/hello")).toBe(false);
		expect(matchPattern("/ui/*", "/ui")).toBe(true);
		expect(matchPattern("/ui/*", "/ui/components/button")).toBe(true);
		expect(matchPattern("/ui/*", "/uix")).toBe(false);
	});

	it("忽略尾部斜杠，根路径只匹配根", () => {
		expect(matchPattern("/blog", "/blog/")).toBe(true);
		expect(matchPattern("/", "/")).toBe(true);
		expect(matchPattern("/", "/blog")).toBe(false);
		expect(matchesAny(BLOG, undefined)).toBe(false);
	});
});

describe("resolveTransitionKind", () => {
	it("前台页面之间默认交叉淡入淡出，包括此前被排除的页面", () => {
		for (const [from, to] of [
			["/", "/blog"],
			["/blog", "/blog/hello"],
			["/blog/hello", "/blog/archive"],
			["/series", "/series/book"],
			["/galleries", "/galleries/trip"],
			["/notes", "/notes/1"],
			["/tweets", "/users/alice"],
			["/", "/projects"],
			["/projects", "/about"],
			["/friends", "/changelog"],
			["/login", "/register"],
			["/", "/chat"],
			["/profile", "/"],
			["/announcements/1", "/"],
			["/ui", "/"],
		] as const)
			expect(resolveTransitionKind(from, to), `${from} → ${to}`).toBe("fade");
	});

	it("后台、实验页与文档站内部不做转场；进出文档站仍有淡入淡出", () => {
		expect(resolveTransitionKind("/", "/admin")).toBe("none");
		expect(resolveTransitionKind("/admin/posts", "/")).toBe("none");
		expect(resolveTransitionKind("/admin/posts", "/admin/users")).toBe("none");
		expect(resolveTransitionKind("/", "/lab/sketch")).toBe("none");
		expect(resolveTransitionKind("/ui/components/button", "/ui/guides/theming")).toBe("none");
		expect(resolveTransitionKind("/", "/ui")).toBe("fade");
		expect(resolveTransitionKind("/ui", "/blog")).toBe("fade");
	});

	it("没有来源（首次进入）时按目标判断", () => {
		expect(resolveTransitionKind(undefined, "/blog")).toBe("fade");
		expect(resolveTransitionKind(undefined, "/admin")).toBe("none");
	});
});

describe("resolveViewTransitionTypes", () => {
	const none = null;
	const intent = { name: "cover", id: "a", scope: BLOG } as const;

	it("只改查询参数或哈希的导航不做转场", () => {
		expect(
			resolveViewTransitionTypes({
				from: "/blog",
				to: "/blog",
				pathChanged: false,
				intent: none,
			}),
		).toBe(false);
	});

	it("规则判定为 none 时不做转场，即使有共享元素意图", () => {
		expect(
			resolveViewTransitionTypes({ from: "/admin", to: "/blog", pathChanged: true, intent }),
		).toBe(false);
	});

	it("没有意图时淡入淡出，意图覆盖两端时升级为 morph", () => {
		expect(
			resolveViewTransitionTypes({ from: "/", to: "/blog", pathChanged: true, intent: none }),
		).toEqual(["fade"]);
		expect(
			resolveViewTransitionTypes({ from: "/blog", to: "/blog/a", pathChanged: true, intent }),
		).toEqual(["morph"]);
		expect(
			resolveViewTransitionTypes({ from: "/blog/a", to: "/blog", pathChanged: true, intent }),
		).toEqual(["morph"]);
		// 意图只覆盖一端：去往范围之外仍是淡入淡出。
		expect(
			resolveViewTransitionTypes({
				from: "/blog/a",
				to: "/about",
				pathChanged: true,
				intent,
			}),
		).toEqual(["fade"]);
	});
});

describe("共享元素意图", () => {
	it("导航两端都在范围内时保留意图，离开范围就清除", () => {
		markSharedSource("cover", "a", BLOG);
		expect(reconcileIntent("/blog", "/blog/a")?.id).toBe("a");
		expect(useSharedIntent.getState().intent).not.toBeNull();
		expect(reconcileIntent("/blog/a", "/about")).toBeNull();
		expect(useSharedIntent.getState().intent).toBeNull();
	});

	it("从范围外进入也清除，避免上一次的残留意图在别处生效", () => {
		markSharedSource("cover", "a", BLOG);
		expect(reconcileIntent("/", "/blog")).toBeNull();
	});

	it("没有意图时整理是空操作", () => {
		expect(reconcileIntent("/", "/blog")).toBeNull();
	});
});

describe("共享元素实例与退出", () => {
	const TWEETS = ["/tweets", "/users/$username"];
	const named = (text: string) =>
		(screen.getByText(text).parentElement as HTMLElement).style.viewTransitionName;

	it("同一实体出现多次时，只有被点击的那个实例带转场名，目标页的元素不声明实例", () => {
		render(
			<>
				<SharedElement name="avatar" id="u1" instance="t1">
					<span>t1</span>
				</SharedElement>
				<SharedElement name="avatar" id="u1" instance="t2">
					<span>t2</span>
				</SharedElement>
				<SharedElement name="avatar" id="u1">
					<span>target</span>
				</SharedElement>
			</>,
		);
		act(() => markSharedSource("avatar", "u1", TWEETS, "t2"));
		expect(named("t1")).toBe("");
		expect(named("t2")).toBe("vt-avatar");
		expect(named("target")).toBe("vt-avatar");
	});

	it("NoSharedElements 内的元素不参与，即使意图匹配", () => {
		render(
			<>
				<SharedElement name="avatar" id="u1">
					<span>panel</span>
				</SharedElement>
				<NoSharedElements>
					<SharedElement name="avatar" id="u1" instance="t1">
						<span>feed</span>
					</SharedElement>
				</NoSharedElements>
			</>,
		);
		act(() => markSharedSource("avatar", "u1", TWEETS, "t1"));
		expect(named("panel")).toBe("vt-avatar");
		expect(named("feed")).toBe("");
	});
});

describe("SharedElement", () => {
	const view = (id: string) => screen.getByText(id).parentElement as HTMLElement;

	it("只有意图匹配的那一个元素带上转场名与共享类", () => {
		render(
			<>
				<SharedElement name="cover" id="a">
					<span>a</span>
				</SharedElement>
				<SharedElement name="cover" id="b">
					<span>b</span>
				</SharedElement>
			</>,
		);
		expect(view("a").style.viewTransitionName).toBe("");
		act(() => markSharedSource("cover", "a", BLOG));
		expect(view("a").style.viewTransitionName).toBe("vt-cover");
		expect(view("a").className).toContain("vt-shared");
		expect(view("b").style.viewTransitionName).toBe("");
		expect(view("b").className).not.toContain("vt-shared");
	});

	it("name 不同的意图不影响元素；意图清除后转场名撤销", () => {
		render(
			<SharedElement name="avatar" id="a">
				<span>x</span>
			</SharedElement>,
		);
		act(() => markSharedSource("cover", "a", BLOG));
		expect(view("x").style.viewTransitionName).toBe("");
		act(() => markSharedSource("avatar", "a", BLOG));
		expect(view("x").style.viewTransitionName).toBe("vt-avatar");
		act(() => useSharedIntent.getState().clear());
		expect(view("x").style.viewTransitionName).toBe("");
	});
});
