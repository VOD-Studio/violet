import { describe, expect, it } from "vitest";

import { getSignaturePreset, hasSignaturePreset } from "./signature-presets";

describe("built-in signature selection", () => {
	it("resolves the account handle and display name to the same authored signature", () => {
		const signature = getSignaturePreset("Mizuki Miru");

		expect(signature.name).toBe("Mizuki Miru");
		expect(getSignaturePreset("  MIZUKI_MIRU  ")).toBe(signature);
		expect(hasSignaturePreset("Mizuki_Miru")).toBe(true);
	});

	it("keeps the kana and Chinese signatures distinct", () => {
		expect(getSignaturePreset("水月みる").name).toBe("水月みる");
		expect(getSignaturePreset("水月见").name).toBe("水月见");
		expect(getSignaturePreset("水月みる")).not.toBe(getSignaturePreset("水月见"));
	});

	it("does not mistake an unknown author or object property for a built-in signature", () => {
		expect(hasSignaturePreset("guest-writer")).toBe(false);
		expect(hasSignaturePreset("constructor")).toBe(false);
		expect(hasSignaturePreset("__proto__")).toBe(false);
		expect(hasSignaturePreset("  ")).toBe(false);
	});
});
