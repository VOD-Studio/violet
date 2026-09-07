import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { PersonaEditorToolbar } from "../PersonaEditorToolbar";
import { PersonaOperationError } from "../PersonaOperationError";

const baseProps = {
	canManage: true,
	isActive: false,
	isComplete: true,
	saveState: "saved" as const,
	busy: false,
	activating: false,
	onActivate: vi.fn(),
	onDelete: vi.fn(),
	onSave: vi.fn(),
};

describe("人设工作台动作状态", () => {
	it("有未保存修改时阻止激活与删除，但允许显式保存", () => {
		const onSave = vi.fn();
		render(<PersonaEditorToolbar {...baseProps} saveState="dirty" onSave={onSave} />);

		const activate = screen.getByRole("button", { name: "设为当前人设" });
		const remove = screen.getByRole("button", { name: "删除" });
		const save = screen.getByRole("button", { name: "保存档案" });
		expect((activate as HTMLButtonElement).disabled).toBe(true);
		expect(activate.getAttribute("title")).toBe("请先保存修改");
		expect((remove as HTMLButtonElement).disabled).toBe(true);
		expect((save as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(save);
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("当前人设只允许查看公开页且不能删除", () => {
		render(<PersonaEditorToolbar {...baseProps} isActive />);

		expect(screen.getByRole("link", { name: "查看公开页" }).getAttribute("href")).toBe(
			"/persona",
		);
		const remove = screen.getByRole("button", { name: "删除" });
		expect((remove as HTMLButtonElement).disabled).toBe(true);
		expect(remove.getAttribute("title")).toBe("当前人设不能删除");
	});

	it("版本冲突给出显式重新载入动作", () => {
		const onReload = vi.fn();
		render(
			<PersonaOperationError
				error={{ kind: "conflict", message: "服务器上的档案已更新" }}
				onReload={onReload}
			/>,
		);

		expect(screen.getByRole("alert").textContent).toContain("服务器上的档案已更新");
		fireEvent.click(screen.getByRole("button", { name: "重新载入" }));
		expect(onReload).toHaveBeenCalledTimes(1);
	});
});
