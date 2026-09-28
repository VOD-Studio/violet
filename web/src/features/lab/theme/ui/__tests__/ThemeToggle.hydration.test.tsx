import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "../ThemeToggle";

let storedTheme: "dark" | undefined;

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: storedTheme, setTheme: vi.fn() }),
}));

afterEach(() => {
	storedTheme = undefined;
});

describe("ThemeToggle hydration", () => {
	it("服务端无浏览器主题时仍能水合深色偏好并选中暗色", async () => {
		storedTheme = undefined;
		const host = document.createElement("div");
		host.innerHTML = renderToString(<ThemeToggle size="sm" />);
		document.body.append(host);
		storedTheme = "dark";
		const recover = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(host, <ThemeToggle size="sm" />, {
					onRecoverableError: recover,
				});
			});
			expect(recover).not.toHaveBeenCalled();
			const dark = host.querySelectorAll('[role="radio"]')[1];
			expect(dark.getAttribute("aria-checked")).toBe("true");
			expect(dark.querySelector("svg.lucide-moon")).not.toBeNull();
		} finally {
			if (root) await act(async () => root?.unmount());
			host.remove();
		}
	});
});
