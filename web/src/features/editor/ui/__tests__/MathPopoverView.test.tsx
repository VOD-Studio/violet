/**
 * MathPopoverView 公式弹层回归测试
 *
 * 锁定的契约（公式弹层卡死修复，症状见原 issue）：
 * - 打开弹窗（点选公式进入 NodeSelection）后，浮层定位应收敛：
 *   computePosition 调用次数有界。此前 useFloatingMathPanel 的
 *   useLayoutEffect 无依赖数组 + setPosition 每次新对象，形成
 *   「渲染 → 重定位 → setState → 渲染」失控循环，页面卡死。
 * - Ctrl+A 全选（AllSelection）不应触发公式弹窗：弹窗只对
 *   锚在本节点的 NodeSelection 开放。此前用 selected prop 区间
 *   覆盖判断，全选时所有公式弹窗齐开，每个都带一条失控循环。
 *
 * 探针：弹层每次重定位必调 @floating-ui/dom 的 computePosition，
 * 计数即失控循环的直接证据。
 */

import { act, render } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "../../extensions";

const probes = vi.hoisted(() => ({ computeCalls: 0 }));

vi.mock("@floating-ui/dom", async (importActual) => {
	const actual = await importActual<typeof import("@floating-ui/dom")>();
	const instrumented = (...args: Parameters<typeof actual.computePosition>): Promise<unknown> => {
		probes.computeCalls++;
		return actual.computePosition(...args);
	};
	return { ...actual, computePosition: instrumented };
});

// jsdom 无 pretendToBeVisual 时缺 rAF，关窗确认路径依赖它，补定时器版
if (typeof globalThis.requestAnimationFrame !== "function") {
	globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
		setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number) =>
		clearTimeout(id)) as typeof cancelAnimationFrame;
}

// lib target 低于 es2024，无 Promise.withResolvers，用 executor 形式
const sleep = (ms: number): Promise<void> =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

let harnessEditor: Editor | null = null;
let harnessScroller: HTMLElement | null = null;

function Harness() {
	const editor = useEditor({
		extensions: buildEditorExtensions(),
		content: "",
		onCreate: ({ editor: e }) => {
			harnessEditor = e;
		},
	});
	return (
		<div
			ref={(el) => {
				// findScrollContainer 要求 scrollHeight > clientHeight；jsdom 恒为 0，手动定义
				if (el) {
					Object.defineProperty(el, "scrollHeight", {
						value: 1000,
						configurable: true,
					});
					Object.defineProperty(el, "clientHeight", {
						value: 400,
						configurable: true,
					});
					harnessScroller = el;
				}
			}}
			style={{ overflowY: "auto", height: 400 }}
		>
			<EditorContent editor={editor} />
		</div>
	);
}

/**
 * 挂载编辑器并以 markdown 注入内容。
 * 注意：编辑器命令不裹 act——修复前弹层失控循环会让 act 永等不到
 * 队列清空而卡死（这本身即症状）；用 sleep 等渲染落定即可。
 */
async function mountWithMarkdown(markdown: string): Promise<Editor> {
	render(<Harness />);
	await act(() => sleep(100)); // 等 EditorContent 初始化
	const editor = harnessEditor;
	if (!editor) throw new Error("editor 未初始化");
	editor.commands.setContent(markdown, { contentType: "markdown" });
	await sleep(150); // 等公式 node view 渲染
	return editor;
}

/** 在 doc 中找第 index 个数学节点的 pos */
function findMathPos(editor: Editor, index: number): number {
	let found = -1;
	let count = 0;
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === "inlineMath" || node.type.name === "blockMath") {
			if (count === index) {
				found = pos;
				return false;
			}
			count++;
		}
		return true;
	});
	if (found < 0) throw new Error(`第 ${index} 个数学节点不存在`);
	return found;
}

/** 弹层面板 = Portal 进滚动容器的 MathEditPanel（含 input/textarea 源码框） */
function countOpenPanels(): number {
	return harnessScroller?.querySelectorAll("input, textarea").length ?? 0;
}

/** 健康路径下开窗只定位个位数次；失控循环 300ms 内可达数百次 */
const BOUNDED_CALLS = 20;

afterEach(() => {
	harnessEditor = null;
	harnessScroller = null;
	document.body.innerHTML = "";
});

describe("MathPopoverView 弹层", () => {
	it("点选公式块打开弹窗后，重定位调用有界", async () => {
		const editor = await mountWithMarkdown("$$E=mc^2$$");
		probes.computeCalls = 0;

		editor.commands.setNodeSelection(findMathPos(editor, 0));
		await sleep(300);

		const calls = probes.computeCalls;
		editor.destroy();
		expect(countOpenPanels()).toBe(1);
		expect(calls).toBeLessThan(BOUNDED_CALLS);
	});

	it("点选行内公式打开弹窗后，重定位调用有界", async () => {
		const editor = await mountWithMarkdown("公式 $x+1$ 结束");
		probes.computeCalls = 0;

		editor.commands.setNodeSelection(findMathPos(editor, 0));
		await sleep(300);

		const calls = probes.computeCalls;
		editor.destroy();
		expect(countOpenPanels()).toBe(1);
		expect(calls).toBeLessThan(BOUNDED_CALLS);
	});

	it("多公式 Ctrl+A 全选不触发弹窗", async () => {
		const editor = await mountWithMarkdown("甲 $a^2$ 乙 $b^2$ 丙 $c^2$");
		probes.computeCalls = 0;

		editor.commands.selectAll();
		await sleep(300);

		const calls = probes.computeCalls;
		editor.destroy();
		expect(countOpenPanels()).toBe(0);
		expect(calls).toBeLessThan(BOUNDED_CALLS);
	});
});
