import type { Command, ResultOf } from "./types";

export * from "./types";

export function initPet(module?: BufferSource | WebAssembly.Module | URL | string): Promise<unknown>;
/** 原始 JSON 字符串入口。 */
export function execute(input: string): string;
/** 强类型入口:返回类型由命令的 `op` 决定。 */
export function run<C extends Command>(command: C): ResultOf<C>;
