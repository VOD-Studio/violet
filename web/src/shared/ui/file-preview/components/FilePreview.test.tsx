import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilePreview } from "./FilePreview";

describe("FilePreview viewer variant", () => {
	it("默认 inline 保留边框，viewer 移除外框和重复信息", () => {
		const { container, rerender } = render(
			<FilePreview url="/photo.jpg" mimeType="image/jpeg" name="photo.jpg" size={1024} />,
		);
		expect(container.querySelector(".border")).not.toBeNull();
		expect(container.textContent).toContain("photo.jpg");

		rerender(
			<FilePreview
				url="/photo.jpg"
				mimeType="image/jpeg"
				name="photo.jpg"
				size={1024}
				variant="viewer"
			/>,
		);
		expect(container.querySelector("[data-file-preview-variant='viewer']")).not.toBeNull();
		expect(container.querySelector(".border")).toBeNull();
		expect(container.textContent).not.toContain("photo.jpg");
	});

	it("viewer 中的视频保留宽高比而不是强制占满未定高容器", async () => {
		render(
			<FilePreview url="/clip.mp4" mimeType="video/mp4" name="clip.mp4" variant="viewer" />,
		);

		const player = await screen.findByRole("region", { name: "clip.mp4" });
		const viewer = player.closest("[data-file-preview-variant='viewer']");
		expect(viewer?.classList.contains("w-full")).toBe(true);
		expect(player.classList.contains("aspect-video")).toBe(true);
		expect(player.classList.contains("h-full")).toBe(false);
	});
});
