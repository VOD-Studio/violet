import type { PetSdk } from "../model/types";

/** 未执行 `pnpm pet:sync` 时 glob 为空,演示页据此提示而不是构建失败。 */
const sdkModules = import.meta.glob<PetSdk>("../sdk/index.js");

/** 加载同步到 sdk/ 的规则核心;未同步时抛出 `missing`。 */
export async function loadPetSdk(): Promise<PetSdk> {
	const load = Object.values(sdkModules)[0];
	if (!load) throw new Error("missing");
	const sdk = await load();
	await sdk.initPet();
	return sdk;
}

/** 浏览器随机的 64 位十六进制种子。 */
export function randomSeed(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
