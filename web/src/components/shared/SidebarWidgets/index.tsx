/**
 * 悬浮侧边组件集合
 * 统一管理回到顶部、音乐播放器、快捷评论等悬浮组件
 *
 * 2.0 SSR：MusicPlayer/QuickComment 依赖浏览器 API（APlayer/Plyr/contentEditable），
 * 用 lazy + Suspense 延迟到客户端加载，避免 SSR 阶段 window 未定义崩溃。
 */

import { lazy, Suspense } from "react";
import { BackToTop } from "../BackToTop";

// 浏览器专属：含 APlayer/Plyr（顶层访问 window），SSR 阶段不加载。
// 直接 import components/index.tsx（内部已 lazy APlayer/Plyr），绕过
// features/music/index.ts barrel 的顶层 re-export 副作用。
const MusicPlayer = lazy(() =>
  import("@/features/music/components/index").then((m) => ({
    default: m.MusicPlayer,
  })),
);
// 浏览器专属：评论 RichTextInput 用 contentEditable，SSR 阶段不加载
const QuickComment = lazy(() =>
  import("@/features/comments").then((m) => ({ default: m.QuickComment })),
);

/** 回到顶部按钮配置 */
interface BackToTopConfig {
  /** 触发显示的滚动距离阈值 */
  threshold?: number;
  /** 滚动容器选择器 */
  containerSelector?: string;
  /** 动画风格 */
  variant?: "arrow" | "rocket" | "chevron";
}

/** SidebarWidgets 组件的属性 */
interface SidebarWidgetsProps {
  /** 是否显示回到顶部按钮 */
  showBackToTop?: boolean;
  /** 回到顶部按钮配置 */
  backToTopConfig?: BackToTopConfig;
  /** 是否显示音乐播放器 */
  showMusicPlayer?: boolean;
  /** 是否显示快捷评论按钮 */
  showQuickComment?: boolean;
}

/**
 * 悬浮侧边组件集合
 * 统一管理所有悬浮组件的位置和显示
 */
export function SidebarWidgets({
  showBackToTop = true,
  backToTopConfig,
  showMusicPlayer = true,
  showQuickComment = true,
}: SidebarWidgetsProps) {
  return (
    <>
      {showMusicPlayer && (
        <Suspense fallback={null}>
          <MusicPlayer />
        </Suspense>
      )}
      {showQuickComment && (
        <Suspense fallback={null}>
          <QuickComment />
        </Suspense>
      )}
      {showBackToTop && <BackToTop {...backToTopConfig} />}
    </>
  );
}
