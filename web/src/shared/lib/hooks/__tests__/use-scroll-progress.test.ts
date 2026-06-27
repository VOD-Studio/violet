import { computeScrollProgress } from "@shared/lib/hooks/use-scroll-progress";
import { describe, expect, it } from "vitest";

describe("computeScrollProgress", () => {
    it("returns 0 at top", () => {
        expect(
            computeScrollProgress({
                scrollTop: 0,
                scrollHeight: 2000,
                clientHeight: 800,
            }),
        ).toBe(0);
    });

    it("returns 100 at bottom", () => {
        expect(
            computeScrollProgress({
                scrollTop: 1200,
                scrollHeight: 2000,
                clientHeight: 800,
            }),
        ).toBe(100);
    });

    it("clamps > 100", () => {
        expect(
            computeScrollProgress({
                scrollTop: 9999,
                scrollHeight: 2000,
                clientHeight: 800,
            }),
        ).toBe(100);
    });

    it("returns 0 when not scrollable", () => {
        expect(
            computeScrollProgress({
                scrollTop: 0,
                scrollHeight: 800,
                clientHeight: 800,
            }),
        ).toBe(0);
    });
});
