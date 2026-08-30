import { describe, expect, it } from "vitest";
import { matchesAcceptedFile } from "../matches-accepted-file";

describe("matchesAcceptedFile", () => {
	it("支持 MIME 通配、精确 MIME 与扩展名规则", () => {
		expect(
			matchesAcceptedFile(new File([], "photo.jpg", { type: "image/jpeg" }), "image/*"),
		).toBe(true);
		expect(
			matchesAcceptedFile(new File([], "clip.mp4", { type: "video/mp4" }), "image/*"),
		).toBe(false);
		expect(
			matchesAcceptedFile(
				new File([], "document.pdf", { type: "application/pdf" }),
				"image/*, application/pdf",
			),
		).toBe(true);
		expect(matchesAcceptedFile(new File([], "notes.md"), ".md")).toBe(true);
	});
});
