import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type MentionCandidate, MentionList, mentionOptionId } from "../mention";

const PEOPLE: MentionCandidate[] = [
	{
		id: "u1",
		username: "saber",
		displayName: "Saber",
		role: "owner",
		isBot: true,
	},
	{ id: "u2", username: "linjian", displayName: "林间", role: "member" },
	{ id: "u3", username: "momo", displayName: "Momo" },
];

const BROADCAST: MentionCandidate = {
	id: "all",
	username: "all",
	displayName: "全体成员",
	memberCount: 23,
};

/** 受控高亮：模拟宿主自己维护的 activeIndex。 */
function Harness({ candidates = PEOPLE }: { candidates?: MentionCandidate[] }) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [selected, setSelected] = useState<string[]>([]);
	return (
		<>
			<MentionList
				activeIndex={activeIndex}
				candidates={candidates}
				id="mentions"
				onActiveIndexChange={setActiveIndex}
				onSelect={(candidate) => setSelected((ids) => [...ids, candidate.id])}
			/>
			<output data-testid="selected">{selected.join(",")}</output>
		</>
	);
}

describe("MentionList", () => {
	it("listbox 用人数作为可访问名称，选项带稳定 id 与选中态", () => {
		render(<Harness candidates={[BROADCAST, ...PEOPLE]} />);

		const listbox = screen.getByRole("listbox", { name: "提及候选，共 4 人" });
		expect(listbox.id).toBe("mentions");
		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(4);
		expect(options[0].id).toBe(mentionOptionId("mentions", "all"));
		expect(options[0].getAttribute("aria-selected")).toBe("true");
		expect(options[1].getAttribute("aria-selected")).toBe("false");
	});

	it("全体成员显示人数，角色与机器人各有标签", () => {
		render(<Harness candidates={[BROADCAST, ...PEOPLE]} />);

		const all = screen.getByRole("option", { name: /全体成员/ });
		expect(all.textContent).toContain("23 人");
		expect(screen.getByRole("option", { name: /Saber/ }).textContent).toContain("管理员");
		expect(screen.getByRole("option", { name: /Saber/ }).textContent).toContain("机器人");
		expect(screen.getByRole("option", { name: /林间/ }).textContent).not.toContain("管理员");
	});

	it("点击或按下都选中，按下时不让编辑区失焦", () => {
		render(<Harness />);
		const option = screen.getByRole("option", { name: /林间/ });

		expect(fireEvent.mouseDown(option)).toBe(false);
		fireEvent.click(option);

		expect(screen.getByTestId("selected").textContent).toBe("u2");
	});

	it("高亮项变化滚进可视区，悬停与键盘共用同一套高亮", () => {
		render(<Harness />);
		const options = screen.getAllByRole("option");
		const scrollIntoView = vi.spyOn(options[1], "scrollIntoView");

		fireEvent.mouseMove(screen.getByRole("listbox"));
		fireEvent.mouseEnter(options[1]);
		expect(options[1].getAttribute("aria-selected")).toBe("true");
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
	});

	it("高亮跟随后下标时，静止指针的 mouseEnter 被忽略，真实移动后恢复", () => {
		function Scenario() {
			const [activeIndex, setActiveIndex] = useState(2);
			return (
				<MentionList
					activeIndex={activeIndex}
					candidates={PEOPLE}
					id="mentions"
					onActiveIndexChange={setActiveIndex}
					onSelect={() => {}}
				/>
			);
		}
		render(<Scenario />);
		const options = screen.getAllByRole("option");

		fireEvent.mouseEnter(options[0]);
		expect(options[0].getAttribute("aria-selected")).toBe("false");

		fireEvent.mouseMove(screen.getByRole("listbox"));
		fireEvent.mouseEnter(options[0]);
		expect(options[0].getAttribute("aria-selected")).toBe("true");
	});

	it("零候选时说明没有这个名字", () => {
		function Empty() {
			return (
				<MentionList
					activeIndex={-1}
					candidates={[]}
					id="mentions"
					onActiveIndexChange={() => {}}
					onSelect={() => {}}
					query="zzz"
				/>
			);
		}
		render(<Empty />);

		expect(screen.getByRole("listbox", { name: "提及候选，共 0 人" })).toBeTruthy();
		expect(screen.getByText("没有叫「zzz」的人")).toBeTruthy();
	});
});
