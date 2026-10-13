// 从 Rust 生成的 JSON Schema 产出 TypeScript 声明。schema 由 pet-schema 输出,此处不手写任何线上类型。
import fs from "node:fs";
import { compile } from "json-schema-to-typescript";

const schema = JSON.parse(fs.readFileSync(new URL("../schema/pet.schema.json", import.meta.url)));
const results = schema["x-op-results"];

// schemars 对内部标签枚举输出 `$ref` 与 `properties` 并列;生成器会丢弃 `$ref`,先改写为 allOf 交叉类型。
for (const v of schema.$defs.Command.oneOf) {
  if (v.$ref && v.properties) {
    const { $ref, ...rest } = v;
    for (const k of Object.keys(v)) delete v[k];
    v.allOf = [{ $ref }, { type: "object", ...rest }];
  }
}
const body = await compile(schema, "PetWire", {
  unreachableDefinitions: true,
  bannerComment: "/* 由 scripts/gen-types.mjs 从 schema/pet.schema.json 生成,请勿手改。 */",
  additionalProperties: false,
});
const ops = Object.entries(results).map(([op, ty]) => `  ${op}: ${ty};`).join("\n");
const extra = `
export interface OpResults {
${ops}
}
export type ResultOf<C extends Command> = OpResults[C["op"]] | ErrorBody;
`;
const withoutRoot = body.replace(/export interface PetWire[A-Za-z]* \{\n  \[k: string\]: unknown;\n\}\n/, "");
fs.writeFileSync(new URL("../src/types.d.ts", import.meta.url), withoutRoot + extra);
