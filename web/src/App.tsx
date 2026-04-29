// 应用根组件
// 配置 React Router v7 路由，包含前台页面、认证页面和后台管理路由
// 前台页面通过 Layout 组件内的 AnimatedOutlet 实现页面切换过渡动画

import { BrowserRouter, Routes, Route } from "react-router"
import { Layout } from "@/components/layout/Layout"
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
    <BrowserRouter>
      {/* 全局光标跟随效果，组件内部处理 reduced-motion 和移动端降级 */}
      <CursorEffect />

      <Routes>
        {/* 前台路由，统一使用 Layout 包裹（Header + Footer） */}
        <Route element={<Layout />}>
          {/* 首页 */}
          <Route path="/" element={<Home />} />

          {/* 博客文章列表 */}
          <Route path="/blog" element={<BlogList />} />

          {/* 博客文章详情，:slug 为文章的 URL 别名 */}
          <Route path="/blog/:slug" element={<BlogPost />} />

          {/* 项目展示页 */}
          <Route path="/projects" element={<Projects />} />

          {/* 关于页 */}
          <Route path="/about" element={<About />} />

          {/* 认证相关路由 */}
          {/* 登录页 */}
          <Route path="/login" element={<Login />} />

          {/* 注册页 */}
          <Route path="/register" element={<Register />} />

          {/* 邮箱验证页 */}
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>

        {/* 后台管理路由组，使用 AdminLayout 布局并需要认证保护 */}
        <Route path="/admin" element={<ProtectedAdmin />}>
          {/* 数据看板首页 */}
          <Route index element={<Dashboard />} />

          {/* 文章管理列表 */}
          <Route path="posts" element={<Posts />} />

          {/* 新建文章 */}
          <Route path="posts/new" element={<PostEdit />} />

          {/* 编辑文章，:id 为文章 ID */}
          <Route path="posts/:id/edit" element={<PostEdit />} />

          {/* 评论管理 */}
          <Route path="comments" element={<Comments />} />

          {/* 媒体库 */}
          <Route path="media" element={<Media />} />

          {/* 用户管理 */}
          <Route path="users" element={<Users />} />

          {/* 站点设置 */}
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
