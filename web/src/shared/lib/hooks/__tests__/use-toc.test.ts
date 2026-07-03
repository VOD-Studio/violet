import { extractToc, pickActiveByPosition, useActiveHeading } from "@shared/lib/hooks/use-toc";
import { act, render } from "@testing-library/react";
import { createElement, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("extractToc", () => {
    it("extracts h2/h3/h4 with explicit ids", () => {
        const html = `
			<h2 id="a">First</h2>
			<p>x</p>
			<h3 id="b">Sub</h3>
			<h4 id="c">Subsub</h4>
		`;
        expect(extractToc(html)).toEqual([
            { level: 2, id: "a", text: "First" },
            { level: 3, id: "b", text: "Sub" },
            { level: 4, id: "c", text: "Subsub" },
        ]);
    });

    it("extracts h4 and generates slug when missing", () => {
        const html = "<h4>Deep Section</h4>";
        expect(extractToc(html)).toEqual([{ level: 4, id: "deep-section", text: "Deep Section" }]);
    });

    it("generates slug id when missing", () => {
        const html = "<h2>Hello World!</h2>";
        expect(extractToc(html)[0].id).toBe("hello-world");
    });

    it("strips inner tags from text", () => {
        const html = '<h2 id="x">Has <code>code</code> inside</h2>';
        expect(extractToc(html)[0].text).toBe("Has code inside");
    });

    it("handles Chinese heading slug", () => {
        const html = "<h2>你好 世界</h2>";
        expect(extractToc(html)[0].id).toBe("你好-世界");
    });

    it("returns empty for no headings", () => {
        expect(extractToc("<p>nope</p>")).toEqual([]);
    });

    it("deduplicates ids for headings with identical text", () => {
        const html = "<h2>Summary</h2><p>x</p><h2>Summary</h2>";
        const toc = extractToc(html);
        expect(toc).toHaveLength(2);
        expect(new Set(toc.map((it) => it.id)).size).toBe(2);
    });
});

describe("pickActiveByPosition", () => {
    it("returns null for empty heading list", () => {
        expect(pickActiveByPosition([])).toBeNull();
    });

    it("picks the last heading whose top has crossed the trigger line", () => {
        // offset <= 0 视为已越过触发线；第一章已越过，第二章尚未到达
        expect(pickActiveByPosition([-200, 300])).toBe(0);
    });

    it("does not jump to a next-chapter heading that is merely visible lower in the viewport", () => {
        // 复现旧 bug：第一章在顶部已越过触发线，第二章第一个标题虽进入视口可见但未越过触发线
        expect(pickActiveByPosition([-150, 450])).toBe(0);
    });

    it("keeps the last crossed heading across a long text gap instead of going empty", () => {
        // 长正文段落：上一个标题已远滚过，下一个标题还远在下方时保持上一个，不丢失高亮
        expect(pickActiveByPosition([-1000, 500])).toBe(0);
    });

    it("falls back to the first heading when none have crossed the line", () => {
        // 页面顶部初始态：所有标题都在触发线下方，回落第一个以保证首章可见即高亮
        expect(pickActiveByPosition([300, 600, 900])).toBe(0);
    });

    it("advances the active index as each subsequent heading crosses the line", () => {
        expect(pickActiveByPosition([-100, -50, 200, 400])).toBe(1);
        expect(pickActiveByPosition([-100, -50, -20, 400])).toBe(2);
        expect(pickActiveByPosition([-100, -50, -20, -10])).toBe(3);
    });

    it("treats a heading sitting exactly on the trigger line as crossed", () => {
        expect(pickActiveByPosition([0, 100])).toBe(0);
    });
});

describe("useActiveHeading", () => {
    let rafCallbacks: Array<FrameRequestCallback>;

    beforeEach(() => {
        rafCallbacks = [];
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        });
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    /** 按 id 注入每个标题相对视口顶的 top；jsdom 下 scroll-margin-top 为空，hook 回落默认 80px 触发线 */
    function mockHeadingTops(topsById: Record<string, number>) {
        vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
            this: HTMLElement,
        ) {
            const top = topsById[this.id] ?? 0;
            const rect: DOMRect = {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                top,
                right: 0,
                bottom: 0,
                left: 0,
                toJSON: () => ({}),
            };
            return rect;
        });
    }

    /** 执行一帧内排队的 rAF 回调，模拟浏览器刷新 */
    function flushFrame() {
        const pending = rafCallbacks;
        rafCallbacks = [];
        for (const cb of pending) cb(0);
    }

    function renderHeadings() {
        const ref = createRef<HTMLElement>();
        const TestComponent = () => {
            const active = useActiveHeading(ref);
            return createElement(
                "main",
                { ref, "data-active": active ?? "null" },
                createElement("h2", { id: "h2-1" }, "第一章"),
                createElement("h2", { id: "h2-2" }, "第二章"),
            );
        };
        return { ref, ...render(createElement(TestComponent)) };
    }

    it("picks the only heading that has crossed the 80px trigger line", () => {
        // 第一章顶部刚越过触发线，第二章第一个标题虽在视口可见但仍在触发线下方
        mockHeadingTops({ "h2-1": 60, "h2-2": 500 });

        const { container } = renderHeadings();

        expect(container.firstElementChild?.getAttribute("data-active")).toBe("h2-1");
    });

    it("advances to the next heading after a scroll pushes it past the trigger line", () => {
        mockHeadingTops({ "h2-1": 60, "h2-2": 500 });

        const { container } = renderHeadings();
        expect(container.firstElementChild?.getAttribute("data-active")).toBe("h2-1");

        // 滚动后第二章越过触发线、第一章滚出
        mockHeadingTops({ "h2-1": -400, "h2-2": 40 });
        act(() => {
            window.dispatchEvent(new Event("scroll"));
            flushFrame();
        });

        expect(container.firstElementChild?.getAttribute("data-active")).toBe("h2-2");
    });

    it("keeps the last crossed heading during a long gap without clearing the highlight", () => {
        // 两章之间大段正文：第一章已远滚过，第二章还远在下方
        mockHeadingTops({ "h2-1": -800, "h2-2": 1200 });

        const { container } = renderHeadings();

        expect(container.firstElementChild?.getAttribute("data-active")).toBe("h2-1");
    });
});
