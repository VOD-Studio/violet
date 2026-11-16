import { CHAT_BADGES } from "@entities/chat-badge";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AVATAR_FRAMES } from "../../model/appearance-catalog";
import { AppearanceOptionGrid } from "./AppearanceOptionGrid";
import { BadgeEquipGrid } from "./BadgeEquipGrid";

it("装饰单选以具名 radio 表达当前项,选择只更新外观草稿", () => {
	const onChange = vi.fn();
	const { rerender } = render(
		<AppearanceOptionGrid
			label="头像框"
			variant="frame"
			options={AVATAR_FRAMES}
			value=""
			onChange={onChange}
		/>,
	);
	const group = screen.getByRole("group", { name: "头像框" });
	expect(within(group).getByRole("radio", { name: "不使用", checked: true })).toBeTruthy();
	const frame = AVATAR_FRAMES[0];
	if (!frame) {
		throw new Error("头像框目录缺失");
	}
	fireEvent.click(within(group).getByRole("radio", { name: frame.name }));
	expect(onChange).toHaveBeenCalledWith(frame.id);
	rerender(
		<AppearanceOptionGrid
			label="头像框"
			variant="frame"
			options={AVATAR_FRAMES}
			value={frame.id}
			onChange={onChange}
			disabled
		/>,
	);
	expect(screen.getByRole("radio", { name: frame.name, checked: true })).toBeTruthy();
	for (const radio of within(group).getAllByRole("radio")) {
		expect(
			(radio as HTMLInputElement).disabled ||
				(radio as HTMLInputElement).matches(":disabled"),
		).toBe(true);
	}
});

describe("徽章复选", () => {
	it("依选择顺序佩戴,满三枚后允许移除并重新选择,未持有项不可选", () => {
		const owned = CHAT_BADGES.slice(0, 4);
		function Harness() {
			const [value, setValue] = useState<string[]>([]);
			return (
				<BadgeEquipGrid
					ownedIDs={owned.map((badge) => badge.id)}
					value={value}
					onChange={setValue}
				/>
			);
		}
		render(<Harness />);
		for (const badge of owned.slice(0, 3)) {
			fireEvent.click(screen.getByRole("checkbox", { name: badge.name }));
		}
		expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
		const first = owned[0];
		const second = owned[1];
		const fourth = owned[3];
		const unowned = CHAT_BADGES[4];
		if (!first || !second || !fourth || !unowned) {
			throw new Error("徽章目录不足以验证佩戴顺序");
		}
		expect(screen.getByText("第 1 枚").closest("label")?.textContent).toContain(first.name);
		expect(
			(screen.getByRole("checkbox", { name: fourth.name }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(
			(screen.getByRole("checkbox", { name: unowned.name }) as HTMLButtonElement).disabled,
		).toBe(true);
		fireEvent.click(screen.getByRole("checkbox", { name: first.name }));
		expect(screen.getByText("第 1 枚").closest("label")?.textContent).toContain(second.name);
		expect(
			(screen.getByRole("checkbox", { name: fourth.name }) as HTMLButtonElement).disabled,
		).toBe(false);
		fireEvent.click(screen.getByRole("checkbox", { name: fourth.name }));
		expect(screen.getByText("第 3 枚").closest("label")?.textContent).toContain(fourth.name);
	});
});
