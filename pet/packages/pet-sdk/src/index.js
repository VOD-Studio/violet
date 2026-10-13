import init, { execute as rawExecute } from "./pet_wasm.js";

let ready = null;

/** 显式初始化;模块导入本身不加载或实例化 WebAssembly。传入 module 可用于 Node 或自定义加载。 */
export function initPet(module) {
  ready ??= init(module === undefined ? undefined : { module_or_path: module });
  return ready;
}

/** 初始化完成后同步调用规则核心,输入输出均为 JSON 字符串。 */
export function execute(input) {
  if (!ready) throw new Error("pet-sdk: call initPet() first");
  return rawExecute(input);
}

export function run(command) {
  return JSON.parse(execute(JSON.stringify(command)));
}
