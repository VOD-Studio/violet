import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ArticleToc, { buildFlatIndexMap, buildTree, computeVisibility } from "./ArticleToc";

beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

const items = [
    { level: 2 as const, id: "h2-1", text: "第一章" },
    { level: 3 as const, id: "h3-1-1", text: "1.1 小节" },
    { level: 3 as const, id: "h3-1-2", text: "1.2 小节" },
    { level: 3 as const, id: "h3-1-3", text: "1.3 小节" },
    { level: 3 as const, id: "h3-1-4", text: "1.4 小节" },
    { level: 3 as const, id: "h3-1-5", text: "1.5 小节" },
    { level: 3 as const, id: "h3-1-6", text: "1.6 小节" },
    { level: 3 as const, id: "h3-1-7", text: "1.7 小节" },
    { level: 2 as const, id: "h2-2", text: "第二章" },
    { level: 3 as const, id: "h3-2-1", text: "2.1 小节" },
    { level: 4 as const, id: "h4-2-1-1", text: "2.1.1 细节" },
    { level: 4 as const, id: "h4-2-1-2", text: "2.1.2 细节" },
    { level: 2 as const, id: "h2-3", text: "第三章" },
];

describe("buildTree", () => {
    it("builds parent-child hierarchy from flat items", () => {
        const { tree, parentMap, nodeMap } = buildTree(items);

        expect(tree).toHaveLength(3);
        expect(tree[0].children).toHaveLength(7);
        expect(tree[1].children).toHaveLength(1);
        expect(tree[1].children[0].children).toHaveLength(2);

        expect(parentMap.get("h3-1-1")).toBe("h2-1");
        expect(parentMap.get("h4-2-1-1")).toBe("h3-2-1");
        expect(parentMap.get("h2-1")).toBeUndefined();

        expect(nodeMap.get("h3-1-4")?.text).toBe("1.4 小节");
    });
});

describe("buildFlatIndexMap", () => {
    it("maps each id to its index in original items", () => {
        const map = buildFlatIndexMap(items);
        expect(map.get("h2-1")).toBe(0);
        expect(map.get("h3-1-4")).toBe(4);
        expect(map.get("h2-3")).toBe(12);
    });
});

describe("computeVisibility", () => {
    const { tree, parentMap, nodeMap } = buildTree(items);

    it("shows all nodes when focus mode is off", () => {
        const { visibleIds } = computeVisibility(tree, parentMap, nodeMap, "h3-1-4", false, false);

        expect(visibleIds.size).toBe(items.length);
    });

    it("shows all nodes when no active id", () => {
        const { visibleIds } = computeVisibility(tree, parentMap, nodeMap, null, true, false);
        expect(visibleIds.size).toBe(items.length);
    });

    it("shows parent chain, siblings and children around active item", () => {
        const { visibleIds } = computeVisibility(tree, parentMap, nodeMap, "h3-1-4", true, false);

        // 父级链
        expect(visibleIds.has("h2-1")).toBe(true);
        // 当前项
        expect(visibleIds.has("h3-1-4")).toBe(true);
        // 前后兄弟（桌面端 N=4）
        expect(visibleIds.has("h3-1-1")).toBe(true);
        expect(visibleIds.has("h3-1-2")).toBe(true);
        expect(visibleIds.has("h3-1-3")).toBe(true);
        expect(visibleIds.has("h3-1-5")).toBe(true);
        expect(visibleIds.has("h3-1-6")).toBe(true);
        expect(visibleIds.has("h3-1-7")).toBe(true);
        // 不相关章节应被隐藏
        expect(visibleIds.has("h2-2")).toBe(false);
        expect(visibleIds.has("h2-3")).toBe(false);
    });

    it("truncates siblings with head/tail anchors when there are too many", () => {
        const { visibleIds, truncation } = computeVisibility(
            tree,
            parentMap,
            nodeMap,
            "h3-1-5",
            true,
            true,
        );

        // 移动端 N=2，当前项前后各 2 个
        expect(visibleIds.has("h3-1-3")).toBe(true);
        expect(visibleIds.has("h3-1-4")).toBe(true);
        expect(visibleIds.has("h3-1-5")).toBe(true);
        expect(visibleIds.has("h3-1-6")).toBe(true);
        expect(visibleIds.has("h3-1-7")).toBe(true);
        // 更远兄弟被截断
        expect(visibleIds.has("h3-1-1")).toBe(false);
        expect(visibleIds.has("h3-1-2")).toBe(false);

        const info = truncation.get("h2-1");
        expect(info?.head).toBe("h3-1-1");
        expect(info?.tail).toBeUndefined();
    });

    it("does not truncate when active item is near list edges", () => {
        const { visibleIds, truncation } = computeVisibility(
            tree,
            parentMap,
            nodeMap,
            "h3-1-1",
            true,
            true,
        );

        expect(visibleIds.has("h3-1-1")).toBe(true);
        expect(visibleIds.has("h3-1-2")).toBe(true);
        expect(visibleIds.has("h3-1-3")).toBe(true);

        const info = truncation.get("h2-1");
        expect(info?.head).toBeUndefined();
        expect(info?.tail).toBe("h3-1-7");
    });

    it("shows direct children of active item", () => {
        const { visibleIds } = computeVisibility(tree, parentMap, nodeMap, "h3-2-1", true, false);

        expect(visibleIds.has("h3-2-1")).toBe(true);
        expect(visibleIds.has("h4-2-1-1")).toBe(true);
        expect(visibleIds.has("h4-2-1-2")).toBe(true);
        expect(visibleIds.has("h2-1")).toBe(false);
    });

    it("truncates root-level siblings when active top-level has many peers", () => {
        const manyRoots = [
            { level: 2 as const, id: "r1", text: "R1" },
            { level: 2 as const, id: "r2", text: "R2" },
            { level: 2 as const, id: "r3", text: "R3" },
            { level: 2 as const, id: "r4", text: "R4" },
            { level: 2 as const, id: "r5", text: "R5" },
            { level: 2 as const, id: "r6", text: "R6" },
            { level: 2 as const, id: "r7", text: "R7" },
            { level: 2 as const, id: "r8", text: "R8" },
            { level: 2 as const, id: "r9", text: "R9" },
            { level: 2 as const, id: "r10", text: "R10" },
            { level: 3 as const, id: "c1", text: "Child" },
        ];
        const t = buildTree(manyRoots);

        const { visibleIds, truncation } = computeVisibility(
            t.tree,
            t.parentMap,
            t.nodeMap,
            "r6",
            true,
            false,
        );

        expect(visibleIds.has("r2")).toBe(true);
        expect(visibleIds.has("r10")).toBe(true);
        expect(visibleIds.has("r1")).toBe(false);

        const rootInfo = truncation.get("root");
        expect(rootInfo?.head).toBe("r1");
        expect(rootInfo?.tail).toBeUndefined();
    });
});

describe("ArticleToc", () => {
    it("renders each item once", () => {
        const contentRef = createRef<HTMLElement>();
        render(
            <ArticleToc
                items={[{ level: 2 as const, id: "a", text: "A" }]}
                contentRef={contentRef}
                forceFocus={false}
            />,
        );
        expect(screen.getAllByText("A").length).toBe(1);
    });

    it("calls onNavigate when a heading is clicked", () => {
        const contentRef = createRef<HTMLElement>();
        const onNavigate = vi.fn();

        render(
            <ArticleToc
                items={items}
                contentRef={contentRef}
                onNavigate={onNavigate}
                forceFocus={false}
            />,
        );

        const buttons = screen.getAllByText("1.2 小节");
        expect(buttons.length).toBe(1);
        const headingButton = buttons[0].closest("button");
        expect(headingButton).toBeTruthy();
        if (headingButton) {
            fireEvent.click(headingButton);
        }
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it("toggles collapse when chevron is clicked", () => {
        const contentRef = createRef<HTMLElement>();

        render(<ArticleToc items={items} contentRef={contentRef} forceFocus={false} />);

        const chevron = screen.getAllByRole("button", { name: "折叠" })[0];
        expect(chevron.getAttribute("aria-expanded")).toBe("true");

        fireEvent.click(chevron);
        expect(chevron.getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(chevron);
        expect(chevron.getAttribute("aria-expanded")).toBe("true");
    });
});
