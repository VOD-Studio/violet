// 应用根组件
// 配置 React Router v7 路由，包含前台页面、认证页面和后台管理路由
// 前台页面通过 Layout 组件内的 AnimatedOutlet 实现页面切换过渡动画
// 包裹 ToastProvider 提供全局通知能力

import { BrowserRouter, Routes, Route } from "react-router"
import { Layout } from "@/components/layout/Layout"
import { ToastProvider } from "@/components/shared/Toast"
import "@/styles/transitions.css"
import AdminLayout from "@/components/layout/AdminLayout"
import { adminLoader } from "@/middleware/auth"
import { CursorEffect } from "@/components/creative"

/* 前台页面组件 */
import Home from "@/pages/Home"
import BlogList from "@/pages/BlogList"
import BlogPost from "@/pages/BlogPost"
import Projects from "@/pages/Projects"
import About from "@/pages/About"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import VerifyEmail from "@/pages/VerifyEmail"

/* 后台管理页面组件 */
import Dashboard from "@/admin/Dashboard"
import Posts from "@/admin/Posts"
import PostEdit from "@/admin/PostEdit"
import Comments from "@/admin/Comments"
import Media from "@/admin/Media"
import Users from "@/admin/Users"
import Settings from "@/admin/Settings"

/**
 * 后台路由保护组件
 * 在渲染 AdminLayout 前检查认证状态，未认证则重定向到登录页
 */
function ProtectedAdmin() {
  adminLoader()
  return <AdminLayout />
}

/**
 * 应用根组件
 * 使用 BrowserRouter 配置路由，前台页面包裹在 Layout 中，后台页面使用 AdminLayout
 */
function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        {/* 全局光标跟随效果 */}
        <CursorEffect />

        <Routes>
          {/* 前台路由 */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Route>

          {/* 后台管理路由 */}
          <Route path="/admin" element={<ProtectedAdmin />}>
            <Route index element={<Dashboard />} />
            <Route path="posts" element={<Posts />} />
            <Route path="posts/new" element={<PostEdit />} />
            <Route path="posts/:id/edit" element={<PostEdit />} />
            <Route path="comments" element={<Comments />} />
            <Route path="media" element={<Media />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
