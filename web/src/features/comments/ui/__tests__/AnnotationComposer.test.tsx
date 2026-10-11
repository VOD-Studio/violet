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
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));

import { AnnotationComposer } from "../AnnotationComposer";

const base = {
	title: "划线批注",
	quote: "被批注的原文",
	body: "我的想法",
	onBodyChange: vi.fn(),
	onSubmit: vi.fn(),
	onCancel: vi.fn(),
	pending: false,
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
		fireEvent.click(screen.getByLabelText("提交批注"));
		expect(onSubmit).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText("模拟登录成功"));
		expect(onLoggedIn).toHaveBeenCalledTimes(1);
	});

	it("已登录时发送按钮显示「发送」并直接提交", () => {
		const onSubmit = vi.fn();
		render(<AnnotationComposer {...base} onSubmit={onSubmit} />);

		expect(screen.queryByText("登录并发送")).toBeNull();
		fireEvent.click(screen.getByLabelText("提交批注"));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("模拟登录成功")).toBeNull();
	});

	it("引言显示被批注的原文，取消按钮触发 onCancel", () => {
		const onCancel = vi.fn();
		render(<AnnotationComposer {...base} onCancel={onCancel} />);

		expect(screen.getByText("被批注的原文")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("取消"));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
