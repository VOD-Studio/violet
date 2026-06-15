// 应用根组件
// 配置 React Router v7 路由，包含前台页面、认证页面和后台管理路由
// 前台页面通过 Layout 组件内的 AnimatedOutlet 实现页面切换过渡动画
// 包裹 ToastProvider 提供全局通知能力

import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import { Layout } from "@/components/layout/Layout";
import { SettingsProvider } from "@/components/shared/SettingsProvider";
import { ToastProvider } from "@/components/shared/Toast";
import { setNavigate } from "@/lib/navigation";
import "@/styles/transitions.css";
import { CursorEffect } from "@/components/creative";
import AdminLayout from "@/components/layout/AdminLayout";
import About from "@/pages/About";
import Announcements from "@/pages/admin/Announcements";
import Comments from "@/pages/admin/Comments";
/* 后台管理页面组件 */
import Dashboard from "@/pages/admin/Dashboard";
import Emojis from "@/pages/admin/Emojis";
import Logs from "@/pages/admin/Logs";
import Media from "@/pages/admin/Media";
import Playlists from "@/pages/admin/Playlists";
import Posts from "@/pages/admin/Post";
import PostEdit from "@/pages/admin/Post/Edit";
import AdminProjects from "@/pages/admin/Projects";
import Roles from "@/pages/admin/Roles";
import Settings from "@/pages/admin/Settings";
import Tags from "@/pages/admin/Tags";
import Users from "@/pages/admin/Users";
import Blog from "@/pages/blog";
import BlogSlug from "@/pages/blog/slug";
/* 前台页面组件 */
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Music from "@/pages/Music";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/Projects/slug";
import Profile from "@/pages/profile";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import { useAuthStore } from "@/store";

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
 */
function App() {
  return (
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
              <Route path="/" element={<Home />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogSlug />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/music" element={<Music />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* 后台管理路由 */}
            <Route path="/admin" element={<ProtectedAdmin />}>
              <Route index element={<Dashboard />} />
              <Route path="posts" element={<Posts />} />
              <Route path="posts/new" element={<PostEdit />} />
              <Route path="posts/:id/edit" element={<PostEdit />} />
              <Route path="comments" element={<Comments />} />
              <Route path="tags" element={<Tags />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="media" element={<Media />} />
              <Route path="emojis" element={<Emojis />} />
              <Route path="playlists" element={<Playlists />} />
              <Route path="users" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="logs" element={<Logs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </SettingsProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
