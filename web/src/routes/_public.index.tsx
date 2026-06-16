import { createFileRoute } from "@tanstack/react-router";

// 首页路由 (/)
//
// 2.0：用 ReactBits 重设计的首页。保留业务逻辑（SEO/StructuredData/usePosts），
// 视觉层用 Aurora + GradientText + DecryptedText 重做。
// 业务逻辑载体在 pages/Home/，此 route 仅做懒加载 + SEO 包装。

import Home from "@/pages/Home";

function HomePage() {
  return <Home />;
}

export const Route = createFileRoute("/_public/")({
  component: HomePage,
});
