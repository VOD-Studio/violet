import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/clipboard", () => ({ copyText: vi.fn().mockResolvedValue(true) }));

import { copyText } from "@shared/lib/clipboard";
import { BotTokenCard } from "../BotTokenCard";

afterEach(() => cleanup());

describe("BotTokenCard", () => {
	it("无明文时不渲染", () => {
		render(<BotTokenCard token={null} botName="Saber" onDismiss={vi.fn()} />);
		expect(screen.queryByLabelText("Bot 凭据")).toBeNull();
	});

	it("展示一次性明文与取不回提醒，复制走剪贴板", async () => {
		const onDismiss = vi.fn();
		render(<BotTokenCard token="violet_bot_abc" botName="Saber" onDismiss={onDismiss} />);
		expect(screen.getByText("violet_bot_abc")).toBeTruthy();
		expect(screen.getByText(/明文只显示这一次/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "复制" }));
		await waitFor(() => expect(copyText).toHaveBeenCalledWith("violet_bot_abc"));

		fireEvent.click(screen.getByRole("button", { name: "完成" }));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
