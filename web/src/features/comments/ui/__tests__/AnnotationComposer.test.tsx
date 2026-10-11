import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnnotationComposer } from "../AnnotationComposer";

const base = {
	title: "划线批注",
	quote: "被批注的原文",
	body: "",
	onBodyChange: vi.fn(),
	onSubmit: vi.fn(),
	onCancel: vi.fn(),
	pending: false,
};

describe("AnnotationComposer", () => {
	it("未登录时显示登录入口，点击触发 onLogin，不渲染输入框", () => {
		const onLogin = vi.fn();
		render(<AnnotationComposer {...base} loginRequired onLogin={onLogin} />);

		expect(screen.getByText("登录后即可发表批注")).toBeTruthy();
		expect(screen.queryByLabelText("提交批注")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /登录/ }));
		expect(onLogin).toHaveBeenCalledTimes(1);
	});

	it("引言显示被批注的原文，取消按钮触发 onCancel", () => {
		const onCancel = vi.fn();
		render(<AnnotationComposer {...base} loginRequired onCancel={onCancel} />);

		expect(screen.getByText("被批注的原文")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("取消"));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
