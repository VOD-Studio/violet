/**
 * 悬浮侧边组件集合
 * 统一管理回到顶部、音乐播放器、快捷评论等悬浮组件
 */

import { MusicPlayer } from "@/features/music";
import { BackToTop } from "../BackToTop";
import { QuickComment } from "@/features/comments";

interface BackToTopConfig {
  /** 触发显示的滚动距离阈值 */
  threshold?: number;
  /** 滚动容器选择器 */
  containerSelector?: string;
  /** 动画风格 */
  variant?: "arrow" | "rocket" | "chevron";
}

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
      {showMusicPlayer && <MusicPlayer />}
      {showQuickComment && <QuickComment />}
      {showBackToTop && <BackToTop {...backToTopConfig} />}
    </>
  );
}
