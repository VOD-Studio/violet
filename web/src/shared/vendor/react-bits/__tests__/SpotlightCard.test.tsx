/**
 * SpotlightCard 命名组契约测试
 *
 * 契约:聚光层的 hover 联动必须走命名组 group/spotlight——
 * Tailwind 编译 group-hover/spotlight: 时选择器锁定 .group/spotlight 祖先,
 * 外层容器的匿名 group(或调用方叠加的任何 group)无法命中。
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpotlightCard } from "../SpotlightCard";

function renderCard(wrapperClassName?: string) {
	const card = (
		<SpotlightCard>
			<p>内容</p>
		</SpotlightCard>
	);
	const { container } = render(
		wrapperClassName ? <div className={wrapperClassName}>{card}</div> : card,
	);
	const root = container.firstElementChild as HTMLElement;
	const card_ = wrapperClassName
		? (root.firstElementChild as HTMLElement)
		: root;
	const layers = card_.querySelectorAll<HTMLElement>("span.pointer-events-none");
	return { card: card_, layers };
}

describe("SpotlightCard 命名组", () => {
	afterEach(cleanup);

	it("卡片根挂命名组,聚光层经 group-hover/spotlight 联动", () => {
		const { card, layers } = renderCard();
		expect(card.classList.contains("group/spotlight")).toBe(true);
		expect(layers.length).toBeGreaterThan(0);
		for (const layer of layers) {
			expect(layer.className).toContain("group-hover/spotlight:opacity-100");
			// 联动类不得含匿名 group-hover(会被任意 .group 祖先命中)
			expect(layer.className).not.toMatch(/(^|\s)group-hover:/);
		}
	});

	it("外层容器携带匿名 group 时聚光联动仍只锁定卡片自身", () => {
		// 模拟旧 bug 场景:CommentItem 外层容器曾是 .group
		const { card, layers } = renderCard("group relative");
		expect(card.classList.contains("group/spotlight")).toBe(true);
		for (const layer of layers) {
			expect(layer.className).toContain("group-hover/spotlight:opacity-100");
		}
	});
});
