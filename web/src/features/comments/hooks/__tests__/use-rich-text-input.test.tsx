/**
 * useRichTextInput 图片行内嵌入测试
 *
 * emoji 插入/DOM↔Markdown 转换的基础行为已由 RichCommentInput.test.tsx 间接覆盖；
 * 本文件聚焦 PRD-0019 新增的图片行内节点能力：
 * - extractImageIds 按出现顺序提取 `![img:id]` 占位符
 * - insertImage 插入/原地更新节点、value 序列化、与 emoji 混合插入互不干扰
 * - markdownToHtml 从占位符 + resolveImage 还原图片节点（外部 value 注入场景）
 *
 * contentEditable 用真实宿主组件渲染（而非纯 renderHook），因为 DOM 操作依赖挂载的
 * ref；通过 onReady 回调把 hook 返回值“递出”给测试直接调用。
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGroups = [
	{
		id: 1,
		name: "默认",
		source: "custom",
		emojis: [{ id: 1, group_id: 1, name: "[smile]", url: "https://example.com/smile.png" }],
	},
];

vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: mockGroups, isLoading: false }),
}));

import {
	extractImageIds,
	type UseRichTextInputReturn,
	useRichTextInput,
} from "../use-rich-text-input";

function Host({
	value,
	onChange,
	resolveImage,
	onImageRemove,
	onReady,
}: {
	value: string;
	onChange: (value: string) => void;
	resolveImage?: (id: string) => string | undefined;
	onImageRemove?: (id: string) => void;
	onReady: (api: UseRichTextInputReturn) => void;
}) {
	const api = useRichTextInput({ value, onChange, resolveImage, onImageRemove });
	onReady(api);
	return (
		<div
			ref={api.contentRef}
			contentEditable
			onInput={api.handleInput}
			data-testid="editor"
			suppressContentEditableWarning
		/>
	);
}

describe("extractImageIds", () => {
	it("空字符串返回空数组", () => {
		expect(extractImageIds("")).toEqual([]);
	});

	it("按出现顺序提取图片 id，忽略 emoji 占位符", () => {
		expect(extractImageIds("你好[smile]![img:a1]世界![img:b2]")).toEqual(["a1", "b2"]);
	});

	it("只有 emoji 占位符时返回空数组", () => {
		expect(extractImageIds("[smile][doge]")).toEqual([]);
	});
});

describe("useRichTextInput 图片行内节点", () => {
	let api: UseRichTextInputReturn;
	const onReady = (a: UseRichTextInputReturn) => {
		api = a;
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		cleanup();
	});

	it("插入 uploading 占位节点：DOM 立即可见，但 value 尚不包含占位符", () => {
		const onChange = vi.fn();
		const { container } = render(
			<Host value="" onChange={onChange} onReady={onReady} />,
		);

		act(() => {
			api.insertImage("img-1", "blob:preview", "uploading");
		});

		const node = container.querySelector('[data-image="img-1"]');
		expect(node).toBeTruthy();
		expect(node?.getAttribute("data-image-status")).toBe("uploading");
		expect(onChange).toHaveBeenLastCalledWith("");
	});

	it("上传完成后原地替换为 done 节点，value 序列化为 ![img:id] 占位符", () => {
		const onChange = vi.fn();
		const { container } = render(
			<Host value="" onChange={onChange} onReady={onReady} />,
		);

		act(() => {
			api.insertImage("img-2", "blob:preview", "uploading");
		});
		act(() => {
			api.insertImage("img-2", "https://cdn.example.com/img-2.png", "done");
		});

		const nodes = container.querySelectorAll('[data-image="img-2"]');
		expect(nodes.length).toBe(1);
		const node = nodes[0] as HTMLImageElement;
		expect(node.tagName).toBe("IMG");
		expect(node.getAttribute("data-image-status")).toBe("done");
		expect(node.src).toBe("https://cdn.example.com/img-2.png");
		expect(onChange).toHaveBeenLastCalledWith("![img:img-2]");
	});

	it("上传失败后原地替换为 error 节点，点击移除并回调 onImageRemove", () => {
		const onChange = vi.fn();
		const onImageRemove = vi.fn();
		const { container } = render(
			<Host value="" onChange={onChange} onImageRemove={onImageRemove} onReady={onReady} />,
		);

		act(() => {
			api.insertImage("img-3", "blob:preview", "uploading");
		});
		act(() => {
			api.insertImage("img-3", "", "error");
		});

		const errorNode = container.querySelector('[data-image="img-3"]');
		expect(errorNode?.getAttribute("data-image-status")).toBe("error");
		// 失败态节点不参与 value 序列化。
		expect(onChange).toHaveBeenLastCalledWith("");

		fireEvent.click(errorNode as Element);

		expect(container.querySelector('[data-image="img-3"]')).toBeNull();
		expect(onImageRemove).toHaveBeenCalledWith("img-3");
	});

	it("emoji 与图片混合插入互不干扰，value 按插入顺序拼接两种占位符", () => {
		const onChange = vi.fn();
		const { container } = render(
			<Host value="" onChange={onChange} onReady={onReady} />,
		);
		const editor = container.querySelector('[data-testid="editor"]') as HTMLElement;
		editor.focus();

		act(() => {
			api.insertEmoji("[smile]", "https://example.com/smile.png");
		});
		act(() => {
			api.insertImage("img-4", "https://cdn.example.com/img-4.png", "done");
		});

		expect(onChange).toHaveBeenLastCalledWith("[smile]![img:img-4]");
	});

	it("markdownToHtml 借助 resolveImage 从占位符还原图片节点（外部 value 注入）", () => {
		const onChange = vi.fn();
		const resolveImage = (id: string) =>
			id === "known" ? "https://cdn.example.com/known.png" : undefined;
		const { container } = render(
			<Host value="![img:known]" onChange={onChange} resolveImage={resolveImage} onReady={onReady} />,
		);

		const node = container.querySelector('[data-image="known"]') as HTMLImageElement;
		expect(node).toBeTruthy();
		expect(node.getAttribute("data-image-status")).toBe("done");
		expect(node.src).toBe("https://cdn.example.com/known.png");
	});

	it("markdownToHtml 遇到无法解析的图片 id 时静默丢弃占位符", () => {
		const onChange = vi.fn();
		const { container } = render(
			<Host value="![img:unknown]" onChange={onChange} onReady={onReady} />,
		);

		expect(container.querySelector('[data-image="unknown"]')).toBeNull();
	});
});
