// 能力文档由 schema 中的 x-capabilities 与错误码枚举产出,与 CLI 帮助、机器可读发现同源。随包分发,供 Skill 引用。
import fs from "node:fs";

const schema = JSON.parse(fs.readFileSync(new URL("../schema/pet.schema.json", import.meta.url)));
const cat = schema["x-capabilities"];
const results = schema["x-op-results"];
const codes = schema.$defs.ErrorCode.oneOf.flatMap((v) =>
  (v.const !== undefined ? [v.const] : v.enum).map((c) => `- \`${c}\`${v.description ? ` — ${v.description}` : ""}`),
);

const lines = [
  "<!-- 由 scripts/gen-docs.mjs 生成,请勿手改。事实源:Rust 的 CAPABILITIES 与线上类型。 -->",
  "# Pet 能力目录",
  "",
  `规则版本:${cat.rules_version}。所有命令为 JSON,\`op\` 字段选择能力;64 位整数以十进制字符串编码。`,
  "",
  "| op | 作用 | 产生状态变化 | 成功响应类型 | 可能的错误 |",
  "|---|---|---|---|---|",
  ...cat.capabilities.map((c) => `| \`${c.op}\` | ${c.summary} | ${c.mutates_state ? "是" : "否"} | \`${results[c.op]}\` | ${c.errors.length ? c.errors.map((e) => `\`${e}\``).join("、") : "—"} |`),
  "",
  "「产生状态变化」表示调用方须把返回的新状态提交到存储;核心本身不写存储。",
  "",
  "## 错误分类",
  "",
  ...codes,
  "",
  "失败响应为 `{ ok: false, code, message }`;按 `code` 分支,`message` 仅供人读。",
  "",
];
fs.mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../docs/capabilities.md", import.meta.url), lines.join("\n"));
