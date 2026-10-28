import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query-client";
import { IssueDeviceDialog } from "../IssueDeviceDialog";

const issue = vi.fn();
vi.mock("../../api/client", () => ({
	issuePresenceDevice: (name: string) => issue(name),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderDialog(onOpenChange = vi.fn()) {
	render(
		<QueryClientProvider client={createQueryClient()}>
			<IssueDeviceDialog open onOpenChange={onOpenChange} />
		</QueryClientProvider>,
	);
	return onOpenChange;
}

describe("IssueDeviceDialog", () => {
	afterEach(() => {
		cleanup();
		issue.mockReset();
	});

	it("签发后只在本次展示凭证与完整上报地址", async () => {
		issue.mockResolvedValue({
			device: {
				id: "d1",
				display_name: "MacBook Pro",
				created_at: "2026-10-28T12:00:00Z",
				online: false,
				updated_at: null,
				expires_at: null,
				sources: null,
			},
			token: "violet_nb_secret",
			ingest_path: "/api/v1/presence/ingest",
		});
		renderDialog();

		const submit = screen.getByRole("button", { name: "签发" });
		expect(submit.hasAttribute("disabled")).toBe(true);
		fireEvent.change(screen.getByLabelText("设备名称"), {
			target: { value: "  MacBook Pro " },
		});
		fireEvent.click(submit);

		await screen.findByText("「MacBook Pro」的凭证已签发");
		expect(issue).toHaveBeenCalledWith("MacBook Pro");
		expect(screen.getByText("violet_nb_secret")).toBeTruthy();
		expect(
			screen.getByText(`ws://${window.location.host}/api/v1/presence/ingest`),
		).toBeTruthy();
	});

	it("关闭后丢弃凭证，再次打开回到填写名称", async () => {
		issue.mockResolvedValue({
			device: {
				id: "d1",
				display_name: "Mac mini",
				created_at: "2026-10-28T12:00:00Z",
				online: false,
				updated_at: null,
				expires_at: null,
				sources: null,
			},
			token: "violet_nb_secret",
			ingest_path: "/api/v1/presence/ingest",
		});
		const onOpenChange = renderDialog();
		fireEvent.change(screen.getByLabelText("设备名称"), { target: { value: "Mac mini" } });
		fireEvent.click(screen.getByRole("button", { name: "签发" }));
		await screen.findByText("violet_nb_secret");

		fireEvent.click(screen.getByRole("button", { name: "完成" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		await waitFor(() => expect(screen.queryByText("violet_nb_secret")).toBeNull());
		expect((screen.getByLabelText("设备名称") as HTMLInputElement).value).toBe("");
	});
});
