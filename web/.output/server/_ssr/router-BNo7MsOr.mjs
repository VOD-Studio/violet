import { c as createRouter, a as createRootRouteWithContext, u as useRouter, O as Outlet, H as HeadContent, S as Scripts, b as createFileRoute, l as lazyRouteComponent } from "../_libs/tanstack__react-router.mjs";
import { z as redirect } from "../_libs/tanstack__router-core.mjs";
import { s as setupRouterSsrQueryIntegration } from "../_libs/@tanstack/react-router-ssr-query+[...].mjs";
import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { b as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { Q as QueryClientProvider, u as useQuery } from "../_libs/tanstack__react-query.mjs";
import { J, z } from "../_libs/next-themes.mjs";
import { a as axios } from "../_libs/axios.mjs";
import { c as create, p as persist } from "../_libs/zustand.mjs";
import { T as Toaster$1 } from "../_libs/sonner.mjs";
import { L as LoaderCircle, O as OctagonX, T as TriangleAlert, I as Info, C as CircleCheck } from "../_libs/lucide-react.mjs";
import "../_libs/react-dom.mjs";
import "async_hooks";
import "util";
import "crypto";
import "stream";
import "node:stream";
import "../_libs/isbot.mjs";
import "../_libs/tanstack__history.mjs";
import "node:stream/web";
import "../_libs/@tanstack/router-ssr-query-core+[...].mjs";
import "../_libs/form-data.mjs";
import "fs";
import "../_libs/combined-stream.mjs";
import "../_libs/delayed-stream.mjs";
import "path";
import "http";
import "https";
import "url";
import "../_libs/mime-types.mjs";
import "../_libs/mime-db.mjs";
import "../_libs/asynckit.mjs";
import "../_libs/es-set-tostringtag.mjs";
import "../_libs/get-intrinsic.mjs";
import "../_libs/es-object-atoms.mjs";
import "../_libs/es-errors.mjs";
import "../_libs/math-intrinsics.mjs";
import "../_libs/gopd.mjs";
import "../_libs/es-define-property.mjs";
import "../_libs/has-symbols.mjs";
import "../_libs/get-proto.mjs";
import "../_libs/dunder-proto.mjs";
import "../_libs/call-bind-apply-helpers.mjs";
import "../_libs/function-bind.mjs";
import "../_libs/hasown.mjs";
import "../_libs/has-tostringtag.mjs";
import "../_libs/proxy-from-env.mjs";
import "../_libs/https-proxy-agent.mjs";
import "net";
import "tls";
import "assert";
import "../_libs/debug.mjs";
import "tty";
import "../_libs/ms.mjs";
import "../_libs/supports-color.mjs";
import "node:process";
import "node:os";
import "node:tty";
import "../_libs/agent-base.mjs";
import "events";
import "http2";
import "../_libs/follow-redirects.mjs";
import "zlib";
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /** 数据过期时间：5 分钟内认为数据是新鲜的 */
        staleTime: 5 * 60 * 1e3,
        /** 请求失败后重试次数 */
        retry: 1,
        /** 窗口重新获得焦点时不自动重新请求 */
        refetchOnWindowFocus: false
      }
    }
  });
}
function QueryProvider({
  children,
  client: client2
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(QueryClientProvider, { client: client2 ?? makeQueryClient(), children });
}
const __vite_import_meta_env__ = { "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SSR": true, "TSS_DEV_SERVER": "false", "TSS_DEV_SSR_STYLES_BASEPATH": "/", "TSS_DEV_SSR_STYLES_ENABLED": "true", "TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false", "TSS_INLINE_CSS_ENABLED": "false", "TSS_ROUTER_BASEPATH": "", "TSS_SERVER_FN_BASE": "/_serverFn/", "VITE_API_URL": "http://localhost/api/v1", "VITE_ENABLE_ANALYTICS": "false", "VITE_ENABLE_GISCUS": "false", "VITE_GITHUB_TOKEN": "", "VITE_SERVER_ORIGIN": "http://localhost", "VITE_SITE_URL": "http://localhost" };
function requireEnv(key) {
  const value = __vite_import_meta_env__[key];
  return value;
}
function optionalEnv(key, fallback = "") {
  const value = __vite_import_meta_env__[key];
  if (value === void 0 || value === null || value === "") {
    return fallback;
  }
  return value;
}
const env = {
  /** 后端 API 基础地址（含 /api/v1 前缀），如 http://localhost:8080/api/v1 */
  apiUrl: requireEnv("VITE_API_URL"),
  /** 服务器根地址（不含 API 前缀），用于拼接上传文件等静态资源 URL */
  serverOrigin: optionalEnv("VITE_SERVER_ORIGIN", "http://localhost:8080"),
  /** 站点公开访问 URL（SEO、og 标签用），如 https://example.com */
  siteUrl: optionalEnv("VITE_SITE_URL", "http://localhost:5173")
};
let router$1 = null;
function setRouter(r) {
  router$1 = r;
}
function navigate(to) {
  router$1?.navigate({ to });
}
const useAuthStore = create()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      user: null,
      setAuth: (token, refreshToken2, expiresIn, refreshExpiresIn, user) => {
        const expiresAt = Date.now() + expiresIn * 1e3;
        const refreshExpiresAtValue = refreshExpiresIn ? Date.now() + refreshExpiresIn * 1e3 : Date.now() + 7 * 24 * 60 * 60 * 1e3;
        set({
          token,
          refreshToken: refreshToken2,
          expiresAt,
          refreshExpiresAt: refreshExpiresAtValue,
          user: user ?? null
        });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => set({
        token: null,
        refreshToken: null,
        expiresAt: null,
        refreshExpiresAt: null,
        user: null
      })
    }),
    {
      name: "auth-storage",
      // 过期检查：从存储恢复后检查 token 是否过期
      // 注意：只清除 access token，保留 refresh token 用于刷新
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.refreshExpiresAt && state.refreshExpiresAt < Date.now()) {
          state.clearAuth();
          return;
        }
        if (state.expiresAt && state.expiresAt < Date.now()) {
          state.token = null;
          state.expiresAt = null;
        }
      }
    }
  )
);
create()((set) => ({
  postId: null,
  hasReachedComments: false,
  setPostId: (postId) => set({ postId, hasReachedComments: false }),
  setHasReachedComments: (hasReachedComments) => set({ hasReachedComments })
}));
create()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed })
    }),
    {
      name: "sidebar-storage"
    }
  )
);
const BASE_URL = env.apiUrl;
const SERVER_ORIGIN = env.serverOrigin;
function getUploadUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SERVER_ORIGIN}${normalizedPath}`;
}
class ApiError extends Error {
  status;
  errors;
  constructor(status, message, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15e3,
  headers: {
    "Content-Type": "application/json"
  }
});
let isRefreshing = false;
let refreshPromise = null;
function isTokenExpiring() {
  const { expiresAt } = useAuthStore.getState();
  if (!expiresAt) return false;
  return expiresAt - Date.now() < 5 * 60 * 1e3;
}
async function refreshToken() {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  const { refreshToken: refreshToken2 } = useAuthStore.getState();
  if (!refreshToken2) {
    throw new Error("No refresh token");
  }
  isRefreshing = true;
  refreshPromise = axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken2 }).then((res) => {
    const { access_token, refresh_token, expires_in, refresh_expires_in } = res.data;
    useAuthStore.getState().setAuth(access_token, refresh_token, expires_in, refresh_expires_in);
    isRefreshing = false;
    refreshPromise = null;
    return access_token;
  }).catch((err) => {
    isRefreshing = false;
    refreshPromise = null;
    useAuthStore.getState().clearAuth();
    throw err;
  });
  return refreshPromise;
}
client.interceptors.request.use(
  async (config) => {
    if (config.url === "/auth/refresh") {
      return config;
    }
    const { token, refreshToken: storedRefreshToken } = useAuthStore.getState();
    if (!token && storedRefreshToken) {
      try {
        const newToken = await refreshToken();
        config.headers.Authorization = `Bearer ${newToken}`;
      } catch {
        useAuthStore.getState().clearAuth();
      }
      return config;
    }
    if (!token) {
      return config;
    }
    if (isTokenExpiring()) {
      try {
        const newToken = await refreshToken();
        config.headers.Authorization = `Bearer ${newToken}`;
      } catch {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData || config.data instanceof Blob || config.data instanceof ArrayBuffer) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => Promise.reject(error)
);
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        const { refreshToken: refreshTokenValue } = useAuthStore.getState();
        if (refreshTokenValue) {
          try {
            const newToken = await refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return client(originalRequest);
          } catch {
            useAuthStore.getState().clearAuth();
          }
        } else {
          useAuthStore.getState().clearAuth();
        }
        if (window.location.pathname !== "/login") {
          navigate("/login");
        }
      }
      throw new ApiError(status, data?.message ?? "请求失败", data?.errors);
    }
    throw new ApiError(0, "网络连接失败，请检查网络状态");
  }
);
const api = {
  async get(endpoint, params) {
    const response = await client.get(endpoint, { params });
    return response.data.data ?? response.data;
  },
  async post(endpoint, body) {
    const response = await client.post(endpoint, body);
    return response.data.data ?? response.data;
  },
  async put(endpoint, body) {
    const response = await client.put(endpoint, body);
    return response.data.data ?? response.data;
  },
  async patch(endpoint, body) {
    const response = await client.patch(endpoint, body);
    return response.data.data ?? response.data;
  },
  async del(endpoint) {
    const response = await client.delete(endpoint);
    return response.data.data ?? response.data;
  }
};
function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get("/settings"),
    staleTime: 5 * 60 * 1e3
    // 5 分钟内认为数据新鲜
  });
}
const defaultSettings = {
  site_name: "我的博客",
  site_description: "",
  github_username: "",
  footer_text: "",
  posts_per_page: 10
};
const SettingsContext = reactExports.createContext(defaultSettings);
function SettingsProvider({ children }) {
  const { data: settings } = usePublicSettings();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsContext.Provider, { value: settings ?? defaultSettings, children });
}
function ToastProvider({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    children,
    /* @__PURE__ */ jsxRuntimeExports.jsx(Toaster$1, { position: "bottom-right", richColors: true, closeButton: true, duration: 3e3 })
  ] });
}
const Toaster = ({ ...props }) => {
  const { theme = "system" } = z();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Toaster$1,
    {
      theme,
      className: "toaster group",
      icons: {
        success: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "size-4" }),
        info: /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "size-4" }),
        warning: /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "size-4" }),
        error: /* @__PURE__ */ jsxRuntimeExports.jsx(OctagonX, { className: "size-4" }),
        loading: /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin" })
      },
      style: {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)"
      },
      toastOptions: {
        classNames: {
          toast: "cn-toast"
        }
      },
      ...props
    }
  );
};
function DefaultPending() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-[50vh] items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" }) });
}
function DefaultError({
  error,
  reset
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xl font-semibold", children: "页面出错了" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "max-w-md text-sm text-muted-foreground", children: error.message || "发生未知错误，请稍后重试。" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        onClick: reset,
        className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90",
        children: "重试"
      }
    )
  ] });
}
const Route$s = createRootRouteWithContext()({
  // SSR head：meta/links，替代 index.html
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Blog Project" }
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }]
  }),
  component: RootComponent
});
function RootComponent() {
  const { queryClient } = Route$s.useRouteContext();
  const router2 = useRouter();
  reactExports.useEffect(() => {
    setRouter(router2);
  }, [router2]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(RootDocument, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(QueryProvider, { client: queryClient, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    J,
    {
      attribute: "class",
      defaultTheme: "system",
      enableSystem: true,
      disableTransitionOnChange: true,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(ToastProvider, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Toaster, {}),
        false
      ] }) })
    }
  ) }) });
}
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("html", { lang: "zh-CN", suppressHydrationWarning: true, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("head", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter$r = () => import("./admin-BPdIQYhO.mjs");
const Route$r = createFileRoute("/admin")({
  beforeLoad: () => {
    const {
      token,
      expiresAt,
      user
    } = useAuthStore.getState();
    const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
    const hasAdminAccess = user?.permissions?.includes("admin:access");
    if (!isAuthenticated || !hasAdminAccess) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$r, "component")
});
const $$splitComponentImporter$q = () => import("../_public-D2qhpQag.mjs");
const Route$q = createFileRoute("/_public")({
  component: lazyRouteComponent($$splitComponentImporter$q, "component")
});
const $$splitComponentImporter$p = () => import("./index-CBH9Gujl.mjs");
const Route$p = createFileRoute("/admin/")({
  component: lazyRouteComponent($$splitComponentImporter$p, "component")
});
const $$splitComponentImporter$o = () => import("../_public.index-CkMelrHh.mjs");
const Route$o = createFileRoute("/_public/")({
  component: lazyRouteComponent($$splitComponentImporter$o, "component")
});
const $$splitComponentImporter$n = () => import("./users-DIYmYDKg.mjs");
const Route$n = createFileRoute("/admin/users")({
  component: lazyRouteComponent($$splitComponentImporter$n, "component")
});
const $$splitComponentImporter$m = () => import("./tags-CN1XOvt1.mjs");
const Route$m = createFileRoute("/admin/tags")({
  component: lazyRouteComponent($$splitComponentImporter$m, "component")
});
const $$splitComponentImporter$l = () => import("./settings-DnA7r8qU.mjs");
const Route$l = createFileRoute("/admin/settings")({
  component: lazyRouteComponent($$splitComponentImporter$l, "component")
});
const $$splitComponentImporter$k = () => import("./roles-CQTHisYf.mjs");
const Route$k = createFileRoute("/admin/roles")({
  component: lazyRouteComponent($$splitComponentImporter$k, "component")
});
const $$splitComponentImporter$j = () => import("./projects-xFzYOg3h.mjs");
const Route$j = createFileRoute("/admin/projects")({
  component: lazyRouteComponent($$splitComponentImporter$j, "component")
});
const $$splitComponentImporter$i = () => import("./playlists-IOw13RUs.mjs");
const Route$i = createFileRoute("/admin/playlists")({
  component: lazyRouteComponent($$splitComponentImporter$i, "component")
});
const $$splitComponentImporter$h = () => import("./media-CQY5ZZMQ.mjs");
const Route$h = createFileRoute("/admin/media")({
  component: lazyRouteComponent($$splitComponentImporter$h, "component")
});
const $$splitComponentImporter$g = () => import("./logs-CQrzhDCq.mjs");
const Route$g = createFileRoute("/admin/logs")({
  component: lazyRouteComponent($$splitComponentImporter$g, "component")
});
const $$splitComponentImporter$f = () => import("./emojis-LoJGPPKU.mjs");
const Route$f = createFileRoute("/admin/emojis")({
  component: lazyRouteComponent($$splitComponentImporter$f, "component")
});
const $$splitComponentImporter$e = () => import("./comments-BkFrCl53.mjs");
const Route$e = createFileRoute("/admin/comments")({
  component: lazyRouteComponent($$splitComponentImporter$e, "component")
});
const $$splitComponentImporter$d = () => import("./announcements-BnxG7lTx.mjs");
const Route$d = createFileRoute("/admin/announcements")({
  component: lazyRouteComponent($$splitComponentImporter$d, "component")
});
const $$splitComponentImporter$c = () => import("../_public.verify-email-Dn-ggXEk.mjs");
const Route$c = createFileRoute("/_public/verify-email")({
  component: lazyRouteComponent($$splitComponentImporter$c, "component")
});
const $$splitComponentImporter$b = () => import("../_public.register-DFYdyZyp.mjs");
const Route$b = createFileRoute("/_public/register")({
  component: lazyRouteComponent($$splitComponentImporter$b, "component")
});
const $$splitComponentImporter$a = () => import("../_public.profile-CQ0wi5VD.mjs");
const Route$a = createFileRoute("/_public/profile")({
  beforeLoad: () => {
    const {
      token,
      expiresAt
    } = useAuthStore.getState();
    const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
    if (!isAuthenticated) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$a, "component")
});
const $$splitComponentImporter$9 = () => import("../_public.music-BSHVakAY.mjs");
const Route$9 = createFileRoute("/_public/music")({
  component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
const $$splitComponentImporter$8 = () => import("../_public.login-7tZZmDbN.mjs");
const Route$8 = createFileRoute("/_public/login")({
  component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
const $$splitComponentImporter$7 = () => import("../_public.about-DA79GKn2.mjs");
const Route$7 = createFileRoute("/_public/about")({
  component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
const $$splitComponentImporter$6 = () => import("./index-BVwm5t-X.mjs");
const Route$6 = createFileRoute("/admin/posts/")({
  component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
const $$splitComponentImporter$5 = () => import("../_public.projects.index-Ntu_rIuF.mjs");
const Route$5 = createFileRoute("/_public/projects/")({
  component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
const $$splitComponentImporter$4 = () => import("../_public.blog.index-DJ_neQ6d.mjs");
const Route$4 = createFileRoute("/_public/blog/")({
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
const $$splitComponentImporter$3 = () => import("./new-DDV_0S9p.mjs");
const Route$3 = createFileRoute("/admin/posts/new")({
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("../_public.projects._id-Du0CMQ1Y.mjs");
const Route$2 = createFileRoute("/_public/projects/$id")({
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("../_public.blog._slug-DHIsBhCH.mjs");
const Route$1 = createFileRoute("/_public/blog/$slug")({
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const $$splitComponentImporter = () => import("../_id.edit-Bqr8pjug.mjs");
const Route = createFileRoute("/admin/posts/$id/edit")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const AdminRoute = Route$r.update({
  id: "/admin",
  path: "/admin",
  getParentRoute: () => Route$s
});
const PublicRoute = Route$q.update({
  id: "/_public",
  getParentRoute: () => Route$s
});
const AdminIndexRoute = Route$p.update({
  id: "/",
  path: "/",
  getParentRoute: () => AdminRoute
});
const PublicIndexRoute = Route$o.update({
  id: "/",
  path: "/",
  getParentRoute: () => PublicRoute
});
const AdminUsersRoute = Route$n.update({
  id: "/users",
  path: "/users",
  getParentRoute: () => AdminRoute
});
const AdminTagsRoute = Route$m.update({
  id: "/tags",
  path: "/tags",
  getParentRoute: () => AdminRoute
});
const AdminSettingsRoute = Route$l.update({
  id: "/settings",
  path: "/settings",
  getParentRoute: () => AdminRoute
});
const AdminRolesRoute = Route$k.update({
  id: "/roles",
  path: "/roles",
  getParentRoute: () => AdminRoute
});
const AdminProjectsRoute = Route$j.update({
  id: "/projects",
  path: "/projects",
  getParentRoute: () => AdminRoute
});
const AdminPlaylistsRoute = Route$i.update({
  id: "/playlists",
  path: "/playlists",
  getParentRoute: () => AdminRoute
});
const AdminMediaRoute = Route$h.update({
  id: "/media",
  path: "/media",
  getParentRoute: () => AdminRoute
});
const AdminLogsRoute = Route$g.update({
  id: "/logs",
  path: "/logs",
  getParentRoute: () => AdminRoute
});
const AdminEmojisRoute = Route$f.update({
  id: "/emojis",
  path: "/emojis",
  getParentRoute: () => AdminRoute
});
const AdminCommentsRoute = Route$e.update({
  id: "/comments",
  path: "/comments",
  getParentRoute: () => AdminRoute
});
const AdminAnnouncementsRoute = Route$d.update({
  id: "/announcements",
  path: "/announcements",
  getParentRoute: () => AdminRoute
});
const PublicVerifyEmailRoute = Route$c.update({
  id: "/verify-email",
  path: "/verify-email",
  getParentRoute: () => PublicRoute
});
const PublicRegisterRoute = Route$b.update({
  id: "/register",
  path: "/register",
  getParentRoute: () => PublicRoute
});
const PublicProfileRoute = Route$a.update({
  id: "/profile",
  path: "/profile",
  getParentRoute: () => PublicRoute
});
const PublicMusicRoute = Route$9.update({
  id: "/music",
  path: "/music",
  getParentRoute: () => PublicRoute
});
const PublicLoginRoute = Route$8.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => PublicRoute
});
const PublicAboutRoute = Route$7.update({
  id: "/about",
  path: "/about",
  getParentRoute: () => PublicRoute
});
const AdminPostsIndexRoute = Route$6.update({
  id: "/posts/",
  path: "/posts/",
  getParentRoute: () => AdminRoute
});
const PublicProjectsIndexRoute = Route$5.update({
  id: "/projects/",
  path: "/projects/",
  getParentRoute: () => PublicRoute
});
const PublicBlogIndexRoute = Route$4.update({
  id: "/blog/",
  path: "/blog/",
  getParentRoute: () => PublicRoute
});
const AdminPostsNewRoute = Route$3.update({
  id: "/posts/new",
  path: "/posts/new",
  getParentRoute: () => AdminRoute
});
const PublicProjectsIdRoute = Route$2.update({
  id: "/projects/$id",
  path: "/projects/$id",
  getParentRoute: () => PublicRoute
});
const PublicBlogSlugRoute = Route$1.update({
  id: "/blog/$slug",
  path: "/blog/$slug",
  getParentRoute: () => PublicRoute
});
const AdminPostsIdEditRoute = Route.update({
  id: "/posts/$id/edit",
  path: "/posts/$id/edit",
  getParentRoute: () => AdminRoute
});
const PublicRouteChildren = {
  PublicAboutRoute,
  PublicLoginRoute,
  PublicMusicRoute,
  PublicProfileRoute,
  PublicRegisterRoute,
  PublicVerifyEmailRoute,
  PublicIndexRoute,
  PublicBlogSlugRoute,
  PublicProjectsIdRoute,
  PublicBlogIndexRoute,
  PublicProjectsIndexRoute
};
const PublicRouteWithChildren = PublicRoute._addFileChildren(PublicRouteChildren);
const AdminRouteChildren = {
  AdminAnnouncementsRoute,
  AdminCommentsRoute,
  AdminEmojisRoute,
  AdminLogsRoute,
  AdminMediaRoute,
  AdminPlaylistsRoute,
  AdminProjectsRoute,
  AdminRolesRoute,
  AdminSettingsRoute,
  AdminTagsRoute,
  AdminUsersRoute,
  AdminIndexRoute,
  AdminPostsNewRoute,
  AdminPostsIndexRoute,
  AdminPostsIdEditRoute
};
const AdminRouteWithChildren = AdminRoute._addFileChildren(AdminRouteChildren);
const rootRouteChildren = {
  PublicRoute: PublicRouteWithChildren,
  AdminRoute: AdminRouteWithChildren
};
const routeTree = Route$s._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const queryClient = makeQueryClient();
  const router2 = createRouter({
    routeTree,
    // hover 预取：鼠标悬停链接即触发 loader，实现零延迟跳转
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError,
    context: { queryClient }
  });
  setupRouterSsrQueryIntegration({ router: router2, queryClient });
  return router2;
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  api as a,
  env as e,
  getUploadUrl as g,
  router as r
};
