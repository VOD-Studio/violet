import type { ExternalTweet } from "@entities/tweet/model/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const withdraw = vi.fn();
vi.mock("@features/tweets/api/mutations", () => ({
	useManageExternalTweet: (_id: string, action: string) => ({
		mutate: action === "refresh" ? refresh : withdraw,
		isPending: false,
	}),
}));
vi.mock("@violet/ui/confirm-dialog", () => ({
	ConfirmDialog: ({
		open,
		onConfirm,
		confirmLabel,
	}: {
		open: boolean;
		onConfirm: () => void;
		confirmLabel: string;
	}) =>
		open ? (
			<button type="button" onClick={onConfirm}>
				{confirmLabel}
			</button>
		) : null,
}));

import { ExternalTweetActions } from "../ExternalTweetActions";

const source: ExternalTweet = {
	id: "source",
	source_id: "20",
	canonical_url: "https://x.com/jack/status/20",
	snapshot_version: "v1",
	availability: "available",
	snapshot: {
		author: {
			id: "12",
			name: "Jack",
			handle: "jack",
			url: "https://x.com/jack",
			avatar_url: "",
		},
		text: "原文",
		segments: null,
		published_at: "2020-01-01T00:00:00Z",
		completeness: "complete",
		media: null,
		warnings: null,
	},
};

async function openMenu() {
	fireEvent.keyDown(screen.getByRole("button", { name: "更多推文操作" }), { key: "Enter" });
	await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
}

describe("共享原文管理菜单", () => {
	beforeEach(() => vi.clearAllMocks());

	it("刷新原文直接执行，本站删除独立委托", async () => {
		const onDelete = vi.fn();
		render(<ExternalTweetActions tweet={source} onDelete={onDelete} />);
		await openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: "刷新原文" }));
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(withdraw).not.toHaveBeenCalled();
		await openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: "删除推文" }));
		expect(onDelete).toHaveBeenCalledTimes(1);
		expect(withdraw).not.toHaveBeenCalled();
	});

	it("下架共享原文必须经过确认，菜单关闭后确认仍可用", async () => {
		render(<ExternalTweetActions tweet={source} />);
		await openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: "下架共享原文" }));
		expect(withdraw).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "下架原文" }));
		expect(withdraw).toHaveBeenCalledTimes(1);
		expect(refresh).not.toHaveBeenCalled();
	});
});
