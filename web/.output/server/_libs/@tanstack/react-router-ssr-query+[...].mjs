import { r as reactExports, j as jsxRuntimeExports } from "../react.mjs";
import { Q as QueryClientProvider } from "../tanstack__react-query.mjs";
import { s as setupCoreRouterSsrQueryIntegration } from "./router-ssr-query-core+[...].mjs";
function setupRouterSsrQueryIntegration(opts) {
  setupCoreRouterSsrQueryIntegration(opts);
  if (opts.wrapQueryClient === false) return;
  const OGWrap = opts.router.options.Wrap || reactExports.Fragment;
  opts.router.options.Wrap = ({ children }) => {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(QueryClientProvider, {
      client: opts.queryClient,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(OGWrap, { children })
    });
  };
}
export {
  setupRouterSsrQueryIntegration as s
};
