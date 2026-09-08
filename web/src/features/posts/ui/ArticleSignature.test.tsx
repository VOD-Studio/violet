import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleSignature } from "./ArticleSignature";

describe("ArticleSignature", () => {
	it("uses the authored vector strokes for a supported author", () => {
		const { container } = render(<ArticleSignature name="xunrua" />);

		expect(container.querySelector("[data-vector-signature]")).not.toBeNull();
		expect(screen.getByText("xunrua")).toBeDefined();
	});

	it("shows an honest text signature when no vector preset exists", () => {
		const { container } = render(<ArticleSignature name="guest-writer" />);

		expect(container.querySelector("[data-vector-signature]")).toBeNull();
		expect(screen.getAllByText("guest-writer")).toHaveLength(2);
	});
});
