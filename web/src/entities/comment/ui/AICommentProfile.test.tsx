import {
	act,
	cleanup,
	createEvent,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIBadge } from "./AIBadge";
import { AICommentProfile } from "./AICommentProfile";
import { CommentAuthorAvatar } from "./CommentAuthorAvatar";

function pointer(target: Element, type: "pointerDown" | "pointerUp", pointerType: string) {
	const event = createEvent[type](target, { bubbles: true });
	Object.defineProperty(event, "pointerType", { value: pointerType });
	fireEvent(target, event);
}

function clickTrigger(trigger: HTMLElement, pointerType = "mouse") {
	pointer(trigger, "pointerDown", pointerType);
	if (pointerType === "touch") fireEvent.touchStart(trigger);
	fireEvent.mouseDown(trigger);
	act(() => trigger.focus());
	pointer(trigger, "pointerUp", pointerType);
	if (pointerType === "touch") fireEvent.touchEnd(trigger);
	fireEvent.mouseUp(trigger);
	fireEvent.click(trigger, { detail: 1 });
}

async function advance(ms = 240) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("AICommentProfile", () => {
	it.each([
		["GPT-5.2", "gpt"],
		["Claude Opus 4.6", "claude"],
		["GLM-4.7", "glm"],
		["Grok-4", "grok"],
		["Grok Bot", "grok"],
		["grok bot", "grok"],
		["Grok-Bot", "grok"],
		["ChatGPT Assistant", "gpt"],
		["Claude Bot", "claude"],
		["GLM Agent", "glm"],
		["DeepSeek AI Assistant", "deepseek"],
		["Kimi 助手", "kimi"],
		["Gemini 机器人", "gemini"],
		["anthropic/claude-sonnet-4", "claude"],
		["DeepSeek-V3", "deepseek"],
		["Kimi K2", "kimi"],
		["Gemini 2.5 Pro", "gemini"],
		["Violet AI", "unknown"],
		["My GPT Assistant", "unknown"],
		["My Grok Bot", "unknown"],
		["Grok Botanical", "unknown"],
	])("%s 的头像、介绍和徽章保持同一归属，不借用授权者头像", async (name, id) => {
		render(
			<>
				<AICommentProfile name={name}>
					<CommentAuthorAvatar name={name} isAI avatarUrl="/uploads/pat-owner.webp" />
				</AICommentProfile>
				<AIBadge show name={name} />
			</>,
		);
		const trigger = screen.getByRole("button");
		const avatar = within(trigger).getByRole("img");
		expect(avatar.getAttribute("src")).not.toBe("/uploads/pat-owner.webp");
		expect(avatar.parentElement?.dataset.aiPersona).toBe(id);
		expect(trigger.dataset.aiPersona).toBe(id);
		expect(screen.getByText("AI").dataset.aiPersona).toBe(id);
		act(() => trigger.focus());
		await advance();
		const card = screen.getByRole("dialog");
		expect(card.dataset.aiPersona).toBe(id);
		expect(card.textContent).toContain(name);
		expect(card.querySelector("a")).toBeNull();
		expect(card.querySelectorAll("img")[1].getAttribute("src")).toBe(
			avatar.getAttribute("src"),
		);
		expect(card.id).toBe(trigger.getAttribute("aria-controls"));
	});

	it("真人同名仍使用真人头像，无署名的通用 AI 徽章不归为未知模型", () => {
		render(
			<>
				<CommentAuthorAvatar name="GPT" isAI={false} avatarUrl="/uploads/human.gif" />
				<AIBadge show />
			</>,
		);
		const avatar = screen.getByRole("img", { name: "GPT" });
		expect(avatar.getAttribute("src")).toBe("/uploads/human.gif");
		expect(avatar.parentElement?.dataset.aiPersona).toBeUndefined();
		expect(screen.getByText("AI").dataset.aiPersona).toBeUndefined();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("未知角色共用形象但不吞掉不同原署名", async () => {
		render(
			<>
				<AICommentProfile name="River Agent">River Agent</AICommentProfile>
				<AICommentProfile name="Local Model">Local Model</AICommentProfile>
			</>,
		);
		act(() => screen.getByRole("button", { name: /River Agent/ }).focus());
		await advance();
		expect(screen.getByRole("dialog").textContent).toContain("River Agent");
		fireEvent.keyDown(document, { key: "Escape" });
		act(() => screen.getByRole("button", { name: /Local Model/ }).focus());
		await advance();
		const card = screen.getByRole("dialog");
		expect(card.textContent).toContain("Local Model");
		expect(card.textContent).not.toContain("River Agent");
	});

	it("从触发器移入卡片可继续阅读，移出后关闭", async () => {
		render(<AICommentProfile name="Claude">Claude</AICommentProfile>);
		const trigger = screen.getByRole("button");
		fireEvent.mouseEnter(trigger);
		await advance();
		const card = screen.getByRole("dialog");
		fireEvent.mouseLeave(trigger);
		fireEvent.mouseEnter(card);
		await advance();
		expect(screen.getByRole("dialog")).toBe(card);
		fireEvent.mouseLeave(card);
		await advance();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("键盘聚焦后激活不会立即反转，Escape 关闭且保留触发器焦点", async () => {
		render(<AICommentProfile name="GLM-4.7">GLM-4.7</AICommentProfile>);
		const trigger = screen.getByRole("button");
		act(() => trigger.focus());
		fireEvent.keyDown(trigger, { key: "Enter" });
		fireEvent.click(trigger, { detail: 0 });
		await advance();
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		const escapeEvent = createEvent.keyDown(trigger, { key: "Escape" });
		fireEvent(trigger, escapeEvent);
		expect(escapeEvent.defaultPrevented).toBe(true);
		await advance();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(trigger);
	});

	it.each([
		"mouse",
		"touch",
	])("%s 完整点击序列只切换一次，不被 focus 或合成 click 反转", async (pointerType) => {
		render(<AICommentProfile name="Kimi">Kimi</AICommentProfile>);
		const trigger = screen.getByRole("button");
		clickTrigger(trigger, pointerType);
		await advance();
		expect(screen.getByRole("dialog")).toBeTruthy();
		clickTrigger(trigger, pointerType);
		await advance();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("键盘移到下一项时关闭角色卡，不截留焦点", async () => {
		render(
			<>
				<AICommentProfile name="GPT">GPT</AICommentProfile>
				<button type="button">下一项</button>
			</>,
		);
		act(() => screen.getByRole("button", { name: /GPT/ }).focus());
		await advance();
		act(() => screen.getByRole("button", { name: "下一项" }).focus());
		await advance();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "下一项" }));
	});

	it("卡片内选字不冒泡关闭外层，第一次外点仍由 CartoonPopover 关闭", async () => {
		render(
			<>
				<AICommentProfile name="Gemini">Gemini</AICommentProfile>
				<button type="button">外部操作</button>
			</>,
		);
		clickTrigger(screen.getByRole("button", { name: /Gemini/ }), "touch");
		await advance();
		const onOuterPointerDown = vi.fn();
		document.addEventListener("pointerdown", onOuterPointerDown);
		try {
			const card = screen.getByRole("dialog");
			const selectionStart = createEvent.pointerDown(card, {
				bubbles: true,
				cancelable: true,
			});
			fireEvent(card, selectionStart);
			fireEvent.mouseDown(card);
			expect(selectionStart.defaultPrevented).toBe(false);
			expect(onOuterPointerDown).not.toHaveBeenCalled();
			expect(screen.getByRole("dialog")).toBe(card);
		} finally {
			document.removeEventListener("pointerdown", onOuterPointerDown);
		}
		fireEvent.mouseDown(screen.getByRole("button", { name: "外部操作" }));
		await advance();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("嵌套批注中第一次 Escape 仅关闭角色卡，第二次交还外层", async () => {
		const onOuterClose = vi.fn();
		const onOuterKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) onOuterClose();
		};
		document.addEventListener("keydown", onOuterKeyDown);
		try {
			render(<AICommentProfile name="Grok">Grok</AICommentProfile>);
			clickTrigger(screen.getByRole("button"));
			await advance();
			const escapeEvent = createEvent.keyDown(document, { key: "Escape", cancelable: true });
			fireEvent(document, escapeEvent);
			expect(escapeEvent.defaultPrevented).toBe(true);
			expect(onOuterClose).not.toHaveBeenCalled();
			await advance();
			expect(screen.queryByRole("dialog")).toBeNull();
			fireEvent.keyDown(document, { key: "Escape" });
			expect(onOuterClose).toHaveBeenCalledOnce();
		} finally {
			document.removeEventListener("keydown", onOuterKeyDown);
		}
	});
});
