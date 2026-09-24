import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/clipboard", () => ({ copyText: vi.fn().mockResolvedValue(true) }));

import { copyText } from "@shared/lib/clipboard";
import { BotTokenCard } from "../BotTokenCard";

afterEach(() => cleanup());

describe("BotTokenCard", () => {
	it("无明文时不渲染（查看失败不应留一张空卡）", () => {
		render(<BotTokenCard token={null} botName="Saber" onDismiss={vi.fn()} />);
		expect(screen.queryByLabelText("Bot 凭据")).toBeNull();
	});

	it("展示明文与「可再次查看」说明，复制走剪贴板", async () => {
		const onDismiss = vi.fn();
		render(<BotTokenCard token="violet_bot_abc" botName="Saber" onDismiss={onDismiss} />);
		expect(screen.getByText("violet_bot_abc")).toBeTruthy();
		expect(screen.getByText(/随时可从列表重新查看/)).toBeTruthy();
		expect(screen.queryByText(/只显示这一次/)).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "复制" }));
		await waitFor(() => expect(copyText).toHaveBeenCalledWith("violet_bot_abc"));

		fireEvent.click(screen.getByRole("button", { name: "完成" }));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
