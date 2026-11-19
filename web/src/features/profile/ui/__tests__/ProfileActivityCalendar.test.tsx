import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileActivityCalendar } from "../ProfileActivityCalendar";

describe("逐日公开活动", () => {
	it("零活动日期可读，并支持按天与周移动焦点", () => {
		const days = Array.from({ length: 10 }, (_, index) => ({
			date: `2026-11-${String(index + 1).padStart(2, "0")}`,
			count: index === 9 ? 2 : 0,
		}));
		render(
			<ProfileActivityCalendar
				activity={{
					timezone: "UTC",
					start_date: "2026-11-01",
					end_date: "2026-11-10",
					total: 2,
					days,
				}}
			/>,
		);
		const last = screen.getByRole("button", { name: "2026-11-10，2 次公开活动" });
		last.focus();
		fireEvent.keyDown(last, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "2026-11-03，0 次公开活动" }),
		);
		fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "2026-11-01，0 次公开活动" }),
		);
	});
});
