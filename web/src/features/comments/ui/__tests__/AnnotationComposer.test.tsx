import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 内嵌登录依赖 OAuth 提供者与 CSRF 查询，这里替换为按钮桩，只验证面板如何接线
vi.mock("@features/auth/ui/InlineLogin", () => ({
	InlineLogin: ({ onSuccess }: { onSuccess: () => void }) => (
		<button type="button" onClick={onSuccess}>
			模拟登录成功
		</button>
	),
}));

vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/customemoji/api/queries", () => ({
	useMyCustomEmojis: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));

import { AnnotationComposer } from "../AnnotationComposer";

const base = {
	body: "我的想法",
	onBodyChange: vi.fn(),
	onSubmit: vi.fn(),
	pending: false,
	placeholder: "写下你的批注…",
	editorLabel: "批注内容",
	sendLabel: "提交批注",
};

describe("AnnotationComposer", () => {
	it("未登录点「登录并发送」只展开内嵌登录区，不直接发送；登录成功后通知调用方", () => {
		const onSubmit = vi.fn();
		const onLoggedIn = vi.fn();
		render(
			<AnnotationComposer
				{...base}
				loginRequired
				onSubmit={onSubmit}
				onLoggedIn={onLoggedIn}
			/>,
		);

		expect(screen.queryByText("模拟登录成功")).toBeNull();
		fireEvent.click(screen.getByLabelText("登录并发送"));
		expect(onSubmit).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText("模拟登录成功"));
		expect(onLoggedIn).toHaveBeenCalledTimes(1);
	});

	it("已登录时回车与点发送都直接提交", () => {
		const onSubmit = vi.fn();
		render(<AnnotationComposer {...base} onSubmit={onSubmit} />);

		fireEvent.keyDown(screen.getByRole("textbox", { name: "批注内容" }), { key: "Enter" });
		fireEvent.click(screen.getByLabelText("提交批注"));
		expect(onSubmit).toHaveBeenCalledTimes(2);
		expect(screen.queryByText("模拟登录成功")).toBeNull();
	});

	it("没有内容时不能提交", () => {
		const onSubmit = vi.fn();
		render(<AnnotationComposer {...base} body="  " onSubmit={onSubmit} />);

		fireEvent.keyDown(screen.getByRole("textbox", { name: "批注内容" }), { key: "Enter" });
		expect((screen.getByLabelText("提交批注") as HTMLButtonElement).disabled).toBe(true);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("输入区带表情按钮", () => {
		render(<AnnotationComposer {...base} />);
		expect(screen.getByRole("button", { name: "添加表情" })).toBeTruthy();
	});
});
