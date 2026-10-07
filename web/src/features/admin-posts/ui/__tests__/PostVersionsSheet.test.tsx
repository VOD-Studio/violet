import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostVersionsSheet } from "../PostVersionsSheet";

vi.mock("../../api/queries", () => ({
	usePostVersions: () => ({
		data: [
			{
				id: "version-1",
				summary: "Mixed syntax version",
				created_at: "2026-10-06T00:00:00Z",
			},
		],
		isLoading: false,
	}),
	usePostVersion: (id: string) => ({
		data: id
			? {
					content_md:
						"## Title\n\n<p>H<sub>2</sub>O and x<sup>2</sup></p>\n\n**bold**\n\n<details><summary>More</summary><p>Version details</p></details>",
				}
			: undefined,
		isLoading: false,
	}),
}));

vi.mock("../../api/mutations", () => ({
	useRestoreVersion: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("PostVersionsSheet", () => {
	it("opens a known Markdown version with mixed HTML and working native details", async () => {
		render(<PostVersionsSheet postId="post-1" open onOpenChange={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "预览" }));

		const preview = await screen.findByRole("dialog", { name: "版本内容预览" });
		expect(
			await within(preview).findByRole("heading", { name: "Title", level: 2 }),
		).toBeTruthy();
		expect(preview.querySelector("sub")?.textContent).toBe("2");
		expect(preview.querySelector("sup")?.textContent).toBe("2");
		expect(preview.querySelector("strong")?.textContent).toBe("bold");
		expect(preview.textContent).not.toContain("## Title");
		expect(preview.textContent).not.toContain("**bold**");

		const details = preview.querySelector("details");
		expect(details?.open).toBe(false);
		expect(within(preview).getByText("Version details")).toBeTruthy();
		fireEvent.click(within(preview).getByText("More"));
		expect(details?.open).toBe(true);
		fireEvent.click(within(preview).getByText("More"));
		expect(details?.open).toBe(false);
	});
});
