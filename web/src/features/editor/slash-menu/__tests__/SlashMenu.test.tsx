/**
 * SlashMenuView 键盘导航回归测试
 *
 * 契约：↑↓ 循环导航；键盘导航期间忽略滚动带起的 hover 选中
 * （scrollIntoView 让列表在静止鼠标下滚动，mouseEnter 会把选中劫走），
 * 鼠标真实移动后 hover 选中恢复。
 */
import { fireEvent, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildSlashItems } from "../slash-items";
import { SlashMenuView } from "../SlashMenu";

beforeAll(() => {
    // jsdom 未实现 scrollIntoView，打桩避免选中变化时报错
    Element.prototype.scrollIntoView = vi.fn();
});

function setup() {
    const items = buildSlashItems(() => {});
    const command = vi.fn();
    const utils = render(
        <SlashMenuView
            items={items}
            query=""
            command={command}
            editor={null as unknown as Editor}
        />,
    );
    return { items, command, ...utils };
}

function btn(container: HTMLElement, idx: number): Element {
    const el = container.querySelector(`[data-idx="${idx}"]`);
    if (!el) throw new Error(`无 data-idx=${idx} 项`);
    return el;
}

function isActive(el: Element): boolean {
    return el.classList.contains("bg-accent");
}

describe("SlashMenuView 键盘导航", () => {
    it("首项按 ↑ 回绕到末项，末项按 ↓ 回绕到首项", () => {
        const { container, items } = setup();
        expect(isActive(btn(container, 0))).toBe(true);
        fireEvent.keyDown(window, { key: "ArrowUp" });
        expect(isActive(btn(container, items.length - 1))).toBe(true);
        fireEvent.keyDown(window, { key: "ArrowDown" });
        expect(isActive(btn(container, 0))).toBe(true);
    });

    it("键盘导航后，鼠标静止时的 hover（滚动带起）不劫持选中", () => {
        const { container, items } = setup();
        fireEvent.keyDown(window, { key: "ArrowUp" });
        const last = btn(container, items.length - 1);
        expect(isActive(last)).toBe(true);
        // 模拟 scrollIntoView 后静止鼠标下的 mouseEnter（React 由 mouseover 合成）
        fireEvent.mouseOver(btn(container, 5));
        expect(isActive(last)).toBe(true);
    });

    it("鼠标真实移动后，hover 选中恢复", () => {
        const { container, items } = setup();
        fireEvent.keyDown(window, { key: "ArrowUp" });
        const list = container.firstElementChild;
        if (!list) throw new Error("无列表容器");
        fireEvent.mouseMove(list);
        fireEvent.mouseOver(btn(container, 5));
        expect(isActive(btn(container, 5))).toBe(true);
        expect(isActive(btn(container, items.length - 1))).toBe(false);
    });
});
