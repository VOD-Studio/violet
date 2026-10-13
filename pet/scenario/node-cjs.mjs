import { createRequire } from "node:module";
export const { execute } = createRequire(import.meta.url)("../target/pkg-node/pet_wasm.js");
