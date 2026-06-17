import { j as jsxRuntimeExports } from "../_libs/react.mjs";
function Placeholder({ title, path }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-semibold", children: title }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground", children: [
      "此页面待 2.0 重构迁移",
      path ? `（${path}）` : "",
      "。"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground", children: "Placeholder" })
  ] });
}
export {
  Placeholder as P
};
