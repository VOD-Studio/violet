// 应用根组件
// 配置 React Router v7 路由，包含前台页面、认证页面和后台管理路由
// 前台页面通过 Layout 组件内的 AnimatedOutlet 实现页面切换过渡动画
// 包裹 ToastProvider 提供全局通知能力
//
// 性能策略：所有页面组件使用 React.lazy 懒加载，按前台/后台分包，
// 首屏只加载前台核心代码，后台代码在访问 /admin 时才加载。
// 每个路由级 Suspense 提供加载态 fallback，全局 ErrorBoundary 兜底。

import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { Layout } from "@/components/layout/Layout";
import { SettingsProvider } from "@/components/shared/SettingsProvider";
import { ToastProvider } from "@/components/shared/Toast";
import { setNavigate } from "@/lib/navigation";
import "@/styles/transitions.css";
import { CursorEffect } from "@/components/creative";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthStore } from "@/store";

// ============================================================
// 路由懒加载（按前台/后台分包，首屏只加载前台核心）
// ============================================================

// 前台页面
const Home = lazy(() => import("@/pages/Home"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogSlug = lazy(() => import("@/pages/blog/slug"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/Projects/slug"));
const Music = lazy(() => import("@/pages/Music"));
const About = lazy(() => import("@/pages/About"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const Profile = lazy(() => import("@/pages/profile"));

// 后台管理页面
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Posts = lazy(() => import("@/pages/admin/Post"));
const PostEdit = lazy(() => import("@/pages/admin/Post/Edit"));
const Comments = lazy(() => import("@/pages/admin/Comments"));
const Tags = lazy(() => import("@/pages/admin/Tags"));
const AdminProjects = lazy(() => import("@/pages/admin/Projects"));
const Media = lazy(() => import("@/pages/admin/Media"));
const Emojis = lazy(() => import("@/pages/admin/Emojis"));
const Playlists = lazy(() => import("@/pages/admin/Playlists"));
const Users = lazy(() => import("@/pages/admin/Users"));
const Roles = lazy(() => import("@/pages/admin/Roles"));
const Announcements = lazy(() => import("@/pages/admin/Announcements"));
const Logs = lazy(() => import("@/pages/admin/Logs"));
const Settings = lazy(() => import("@/pages/admin/Settings"));

// ============================================================
// 加载态与错误兜底组件
// ============================================================

/** 页面加载占位符 */
function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}

/** 路由级错误兜底（react-error-boundary fallback），提供重试按钮 */
function RouteErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">页面出错了</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "发生未知错误，请稍后重试。"}
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        重试
      </button>
    </div>
  );
}

/** 全局错误兜底（最外层，捕获未被子边界处理的严重错误） */
function GlobalErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">应用崩溃了</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "发生严重错误，请刷新页面或稍后再试。"}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        刷新页面
      </button>
    </div>
  );
}

// ============================================================
// 辅助组件
// ============================================================

/**
 * 初始化全局导航引用
 * 用于 axios 拦截器等非 React 组件中进行路由跳转
 */
function NavigateSetter() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);
  return null;
}

/**
 * 后台路由保护组件
 * 在渲染 AdminLayout 前检查认证状态，未认证或无权限则重定向到登录页
 * 注意：必须通过渲染 <Navigate> 触发跳转，而非在组件体内调用返回 redirect() 的函数
 * （后者返回值会被 React 渲染流程丢弃，导致跳转失效）
 */
function ProtectedAdmin() {
  const { token, expiresAt, user } = useAuthStore.getState();
  const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
  const hasAdminAccess = user?.permissions?.includes("admin:access");

  if (!isAuthenticated || !hasAdminAccess) {
    return <Navigate to="/login" replace />;
  }
  return <AdminLayout />;
}

/**
 * 应用根组件
 * 使用 BrowserRouter 配置路由，前台页面包裹在 Layout 中，后台页面使用 AdminLayout
 * 全局 ErrorBoundary 兜底，每个路由级 Suspense + ErrorBoundary 提供加载/错误态
 */
function App() {
  return (
    <ErrorBoundary FallbackComponent={GlobalErrorFallback}>
      <ToastProvider>
        <BrowserRouter>
          {/* 全局导航初始化 */}
          <NavigateSetter />
          {/* 全局站点设置 */}
          <SettingsProvider>
            {/* 全局光标跟随效果 */}
            <CursorEffect />

            <Routes>
              {/* 前台路由 */}
              <Route element={<Layout />}>
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Home />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Blog />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog/:slug"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <BlogSlug />
                    </Suspense>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Projects />
                    </Suspense>
                  }
                />
                <Route
                  path="/projects/:id"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <ProjectDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="/music"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Music />
                    </Suspense>
                  }
                />
                <Route
                  path="/about"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <About />
                    </Suspense>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Login />
                    </Suspense>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Register />
                    </Suspense>
                  }
                />
                <Route
                  path="/verify-email"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <VerifyEmail />
                    </Suspense>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Profile />
                    </Suspense>
                  }
                />
              </Route>

              {/* 后台管理路由（整体由 ProtectedAdmin 守卫，子路由各自懒加载 + 错误边界） */}
              <Route path="/admin" element={<ProtectedAdmin />}>
                <Route
                  index
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Dashboard />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="posts"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Posts />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="posts/new"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <PostEdit />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="posts/:id/edit"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <PostEdit />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="comments"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Comments />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="tags"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Tags />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="projects"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <AdminProjects />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="media"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Media />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="emojis"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Emojis />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="playlists"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Playlists />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="users"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Users />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="roles"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Roles />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="announcements"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Announcements />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="logs"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Logs />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
                      <Suspense fallback={<PageLoading />}>
                        <Settings />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
              </Route>
            </Routes>
          </SettingsProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
