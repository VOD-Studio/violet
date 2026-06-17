globalThis.__nitro_main__ = import.meta.url;
import { N as NodeResponse, s as serve } from "./_libs/srvx.mjs";
import { d as defineHandler, H as HTTPError, t as toEventHandler, a as defineLazyEventHandler, b as H3Core } from "./_libs/h3.mjs";
import { d as decodePath, w as withLeadingSlash, a as withoutTrailingSlash, j as joinURL } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "node:http";
import "node:stream";
import "node:stream/promises";
import "node:https";
import "node:http2";
import "./_libs/rou3.mjs";
const headers = ((m) => function headersRouteRule(event) {
  for (const [key2, value] of Object.entries(m.options || {})) {
    event.res.headers.set(key2, value);
  }
});
const assets = {
  "/assets/Aurora-M19Z5cOf.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"c26e-cRkwm/0oFkfAHXm84Fv5VisRIyI"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 49774,
    "path": "../public/assets/Aurora-M19Z5cOf.js"
  },
  "/icons.svg": {
    "type": "image/svg+xml",
    "etag": '"13a7-+Yl6wl4T3p6mAdLxrF2TU9++/No"',
    "mtime": "2026-06-17T13:06:30.588Z",
    "size": 5031,
    "path": "../public/icons.svg"
  },
  "/assets/Placeholder-DTVbGFOc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"20f-4l4j6uBmpF6f89VKP5fMGnOQGpw"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 527,
    "path": "../public/assets/Placeholder-DTVbGFOc.js"
  },
  "/assets/_id.edit-Bha78xRN.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b7-BVmddBeq3+zKB79K396zWYCrD+U"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 183,
    "path": "../public/assets/_id.edit-Bha78xRN.js"
  },
  "/assets/_public.about-c3W3sB_D.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a2-64ej/5eQGiJNtiuOQQdg8palO+E"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 162,
    "path": "../public/assets/_public.about-c3W3sB_D.js"
  },
  "/assets/_public-Dms2uTfr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"cf-ky+HniU14+xALLC9bdvFpJNt6f8"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 207,
    "path": "../public/assets/_public-Dms2uTfr.js"
  },
  "/assets/_public.blog._slug-hmMNEmfL.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ad-RunRcqubIQJJbpoIbWdBHFA+AJY"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 173,
    "path": "../public/assets/_public.blog._slug-hmMNEmfL.js"
  },
  "/assets/_public.blog.index-C_5Oav1k.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a1-kMJCn7rZeTFvXuLu88IvxXHAhwY"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 161,
    "path": "../public/assets/_public.blog.index-C_5Oav1k.js"
  },
  "/assets/_public.music-DgMZZ5Zg.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a2-MwYaMtJKmJVeqZOgSNClWaNtBD8"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 162,
    "path": "../public/assets/_public.music-DgMZZ5Zg.js"
  },
  "/favicon.svg": {
    "type": "image/svg+xml",
    "etag": '"2532-P1u486agW3ymimJYHS3VvIiBLK8"',
    "mtime": "2026-06-17T13:06:30.588Z",
    "size": 9522,
    "path": "../public/favicon.svg"
  },
  "/assets/_public.projects._id-DqE5ylyB.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"af-Q9+NhpgmFD6sAEpb3+WwuvpF4qc"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 175,
    "path": "../public/assets/_public.projects._id-DqE5ylyB.js"
  },
  "/assets/_public.profile-D2azBH2f.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"aa-pLGYmNKBV3XUA67ksity3Hy9X10"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 170,
    "path": "../public/assets/_public.profile-D2azBH2f.js"
  },
  "/assets/_public.login-mqGssY9I.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a2-inX3chMhgMaOXSefFxGbJmjHgoo"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 162,
    "path": "../public/assets/_public.login-mqGssY9I.js"
  },
  "/assets/_public.index-DDIjou_c.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"29a75-Od5RTsC3cry6ovZqTPCE/jcxXKU"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 170613,
    "path": "../public/assets/_public.index-DDIjou_c.js"
  },
  "/assets/_public.projects.index-C2t2ZL5b.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a5-UbxE4Ja44JwIjmYcCxwWgAN0tu4"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 165,
    "path": "../public/assets/_public.projects.index-C2t2ZL5b.js"
  },
  "/assets/_public.verify-email-DE2UqHJE.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"af-HtaXmPiLFFNoptPtJnSc4yt2Msw"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 175,
    "path": "../public/assets/_public.verify-email-DE2UqHJE.js"
  },
  "/assets/admin-N3RdXdFk.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"da-IPUm20j2g3smqRq+1lquM1uCLic"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 218,
    "path": "../public/assets/admin-N3RdXdFk.js"
  },
  "/assets/_public.register-DdM-Z0RA.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a5-YAOAhUYnsio/MD90DGtBvGLHnlA"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 165,
    "path": "../public/assets/_public.register-DdM-Z0RA.js"
  },
  "/assets/comments-wpcWTYXo.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b1-bmAL3ZLt0/iCd3HenkeRbPNAHg0"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 177,
    "path": "../public/assets/comments-wpcWTYXo.js"
  },
  "/assets/announcements-CK5jiBPw.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b6-XtgAkNbhylDDXGq0QHUlSYGfakI"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 182,
    "path": "../public/assets/announcements-CK5jiBPw.js"
  },
  "/assets/emojis-KJQsWCrK.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"af-bn/wjSI6NWaEnz1w68s8H+5V8Yg"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 175,
    "path": "../public/assets/emojis-KJQsWCrK.js"
  },
  "/assets/geist-cyrillic-ext-wght-normal-DjL33-gN.woff2": {
    "type": "font/woff2",
    "etag": '"1cfc-yYSDXNlt/tTRaj6rJo8ZMqvY7pQ"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 7420,
    "path": "../public/assets/geist-cyrillic-ext-wght-normal-DjL33-gN.woff2"
  },
  "/assets/geist-cyrillic-wght-normal-BEAKL7Jp.woff2": {
    "type": "font/woff2",
    "etag": '"3aec-5kpQSZEtAzzU5kdiuro3Zr2YR54"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 15084,
    "path": "../public/assets/geist-cyrillic-wght-normal-BEAKL7Jp.woff2"
  },
  "/assets/geist-latin-ext-wght-normal-DC-KSUi6.woff2": {
    "type": "font/woff2",
    "etag": '"4080-mZu3Z7sOWqglha+kefNbUA9Pp+Q"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 16512,
    "path": "../public/assets/geist-latin-ext-wght-normal-DC-KSUi6.woff2"
  },
  "/assets/geist-latin-wght-normal-BgDaEnEv.woff2": {
    "type": "font/woff2",
    "etag": '"72d8-9J+D7/6th5UzRxIgoFX9awJv47A"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 29400,
    "path": "../public/assets/geist-latin-wght-normal-BgDaEnEv.woff2"
  },
  "/assets/index-BZndqrzF.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ae-vS28Hi4l+GsdzvbLu33fIkaazuY"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 174,
    "path": "../public/assets/index-BZndqrzF.js"
  },
  "/assets/geist-vietnamese-wght-normal-6IgcOCM7.woff2": {
    "type": "font/woff2",
    "etag": '"1f44-6MZ7/PEEOeDVF0eHI650KpwKQV8"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 8004,
    "path": "../public/assets/geist-vietnamese-wght-normal-6IgcOCM7.woff2"
  },
  "/assets/index-DB2xiFH_.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a5-2ESc7TGkLF3lIA4uzPjzsJgmfU8"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 165,
    "path": "../public/assets/index-DB2xiFH_.js"
  },
  "/assets/logs-Bym_TsaS.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ad-e/Uf0uNxEGqP1Yeki8FKpX62YME"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 173,
    "path": "../public/assets/logs-Bym_TsaS.js"
  },
  "/assets/media-CNiVzt3Z.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ab-3eN5KifCI7V4MCRVPeX13bbCjfo"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 171,
    "path": "../public/assets/media-CNiVzt3Z.js"
  },
  "/assets/new-CbotU7Ju.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b2-vjT/Grhga5sYjzWYePyV3TgB55Y"',
    "mtime": "2026-06-17T13:06:29.901Z",
    "size": 178,
    "path": "../public/assets/new-CbotU7Ju.js"
  },
  "/assets/playlists-2xPpDqQF.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b2-OA7on8el72T7ykl4M6EZ0/L3FWM"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 178,
    "path": "../public/assets/playlists-2xPpDqQF.js"
  },
  "/assets/projects-Cjxl4ute.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b1-HjSS/fqaDkK2l8R6LSajaXCPKCU"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 177,
    "path": "../public/assets/projects-Cjxl4ute.js"
  },
  "/assets/roles-B3zluMUc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ae-NMkoNz+iP9ru7ERfi3kRdL1z+OY"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 174,
    "path": "../public/assets/roles-B3zluMUc.js"
  },
  "/assets/index-BHNIJbcD.css": {
    "type": "text/css; charset=utf-8",
    "etag": '"263d3-y39YZZBr8sewJ0YxXb6RvwwB/6g"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 156627,
    "path": "../public/assets/index-BHNIJbcD.css"
  },
  "/assets/settings-_AOhs6q6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"b1-KbGRGiKSSr6Ism/pLYghxPtAuz0"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 177,
    "path": "../public/assets/settings-_AOhs6q6.js"
  },
  "/assets/index-BYCXULw0.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"6fea2-eUV9ZAzae/dRzMRX6LWu9zMcCP0"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 458402,
    "path": "../public/assets/index-BYCXULw0.js"
  },
  "/assets/tags-B0jwABOz.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ad-WUSkpT9Ua0VHnwsMKBhH2bsFbdg"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 173,
    "path": "../public/assets/tags-B0jwABOz.js"
  },
  "/assets/users-DLGLtT_R.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ae-AxlF4ZvwGZzbDxLSWVCzKAggnII"',
    "mtime": "2026-06-17T13:06:29.900Z",
    "size": 174,
    "path": "../public/assets/users-DLGLtT_R.js"
  }
};
function readAsset(id) {
  const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
  return promises.readFile(resolve(serverDir, assets[id].path));
}
const publicAssetBases = {};
function isPublicAssetURL(id = "") {
  if (assets[id]) {
    return true;
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) {
      return true;
    }
  }
  return false;
}
function getAsset(id) {
  return assets[id];
}
const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = {
  gzip: ".gz",
  br: ".br",
  zstd: ".zst"
};
const _9_23Fo = defineHandler((event) => {
  if (event.req.method && !METHODS.has(event.req.method)) {
    return;
  }
  let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
  let asset;
  const encodingHeader = event.req.headers.get("accept-encoding") || "";
  const encodings = [...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      event.res.headers.delete("Cache-Control");
      throw new HTTPError({ status: 404 });
    }
    return;
  }
  if (encodings.length > 1) {
    event.res.headers.append("Vary", "Accept-Encoding");
  }
  const ifNotMatch = event.req.headers.get("if-none-match") === asset.etag;
  if (ifNotMatch) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }
  const ifModifiedSinceH = event.req.headers.get("if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }
  if (asset.type) {
    event.res.headers.set("Content-Type", asset.type);
  }
  if (asset.etag && !event.res.headers.has("ETag")) {
    event.res.headers.set("ETag", asset.etag);
  }
  if (asset.mtime && !event.res.headers.has("Last-Modified")) {
    event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !event.res.headers.has("Content-Encoding")) {
    event.res.headers.set("Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !event.res.headers.has("Content-Length")) {
    event.res.headers.set("Content-Length", asset.size.toString());
  }
  return readAsset(id);
});
const findRouteRules = /* @__PURE__ */ (() => {
  const $0 = [{ name: "headers", route: "/assets/**", handler: headers, options: { "cache-control": "public, max-age=31536000, immutable" } }];
  return (m, p) => {
    let r = [];
    if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
    let s = p.split("/"), l = s.length;
    if (l > 1) {
      if (s[1] === "assets") {
        r.unshift({ data: $0, params: { "_": s.slice(2).join("/") } });
      }
    }
    return r;
  };
})();
const _lazy_GHxmOR = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
const findRoute = /* @__PURE__ */ (() => {
  const data = { route: "/**", handler: _lazy_GHxmOR };
  return ((_m, p) => {
    return { data, params: { "_": p.slice(1) } };
  });
})();
const globalMiddleware = [
  toEventHandler(_9_23Fo)
].filter(Boolean);
const errorHandler$1 = (error, event) => {
  const res = defaultHandler(error, event);
  return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
  const unhandled = error.unhandled ?? !HTTPError.isError(error);
  const { status = 500, statusText = "" } = unhandled ? {} : error;
  if (status === 404) {
    const url = event.url || new URL(event.req.url);
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      return {
        status: 302,
        headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
      };
    }
  }
  const headers2 = new Headers(unhandled ? {} : error.headers);
  headers2.set("content-type", "application/json; charset=utf-8");
  const jsonBody = unhandled ? {
    status,
    unhandled: true
  } : typeof error.toJSON === "function" ? error.toJSON() : {
    status,
    statusText,
    message: error.message
  };
  return {
    status,
    statusText,
    headers: headers2,
    body: {
      error: true,
      ...jsonBody
    }
  };
}
const errorHandlers = [errorHandler$1];
async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      const response = await handler(error, event, { defaultHandler });
      if (response) {
        return response;
      }
    } catch (error2) {
      console.error(error2);
    }
  }
}
function createNitroApp() {
  const captureError = (error, errorCtx) => {
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
    }
  };
  const h3App = createH3App({
    onError(error, event) {
      return errorHandler(error, event);
    }
  });
  let appHandler = (req) => {
    req.context ||= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    return h3App.fetch(req);
  };
  return {
    fetch: appHandler,
    h3: h3App,
    hooks: void 0,
    captureError
  };
}
function createH3App(config) {
  const h3App = new H3Core(config);
  h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
  h3App["~middleware"].push(...globalMiddleware);
  h3App["~getMiddleware"] = (event, route) => {
    const pathname = event.url.pathname;
    const method = event.req.method;
    const middleware = [];
    const routeRules = getRouteRules(method, pathname);
    event.context.routeRules = routeRules?.routeRules;
    if (routeRules?.routeRuleMiddleware.length) {
      middleware.push(...routeRules.routeRuleMiddleware);
    }
    middleware.push(...h3App["~middleware"]);
    if (route?.data?.middleware?.length) {
      middleware.push(...route.data.middleware);
    }
    return middleware;
  };
  return h3App;
}
const APP_ID = "default";
function useNitroApp() {
  let instance = useNitroApp._instance;
  if (instance) {
    return instance;
  }
  instance = useNitroApp._instance = createNitroApp();
  globalThis.__nitro__ = globalThis.__nitro__ || {};
  globalThis.__nitro__[APP_ID] = instance;
  return instance;
}
function getRouteRules(method, pathname) {
  const m = findRouteRules(method, pathname);
  if (!m?.length) {
    return { routeRuleMiddleware: [] };
  }
  const routeRules = {};
  for (const layer of m) {
    for (const rule of layer.data) {
      const currentRule = routeRules[rule.name];
      if (currentRule) {
        if (rule.options === false) {
          delete routeRules[rule.name];
          continue;
        }
        if (typeof currentRule.options === "object" && typeof rule.options === "object") {
          currentRule.options = {
            ...currentRule.options,
            ...rule.options
          };
        } else {
          currentRule.options = rule.options;
        }
        currentRule.route = rule.route;
        currentRule.params = {
          ...currentRule.params,
          ...layer.params
        };
      } else if (rule.options !== false) {
        routeRules[rule.name] = {
          ...rule,
          params: layer.params
        };
      }
    }
  }
  const middleware = [];
  const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
  for (const rule of orderedRules) {
    if (rule.options === false || !rule.handler) {
      continue;
    }
    middleware.push(rule.handler(rule));
  }
  return {
    routeRules,
    routeRuleMiddleware: middleware
  };
}
function _captureError(error, type) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
  process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
  process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
const tracingSrvxPlugins = [];
const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
const port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const nitroApp = useNitroApp();
serve({
  port,
  hostname: host,
  tls: cert && key ? {
    cert,
    key
  } : void 0,
  fetch: nitroApp.fetch,
  plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
const nodeServer = {};
export {
  nodeServer as default
};
