/**
 * 站点设置 Context Provider
 * 在应用启动时获取公开设置，提供全局访问
 */

import { createContext, useContext, type ReactNode } from "react";
import { usePublicSettings } from "@/features/settings";
import type { SiteSettings } from "@/features/settings";

/** 默认站点设置 */
const defaultSettings: SiteSettings = {
  site_name: "我的博客",
  site_description: "",
  github_username: "",
  footer_text: "",
  posts_per_page: 10,
};

/** Settings Context */
const SettingsContext = createContext<SiteSettings>(defaultSettings);

/** SettingsProvider 组件的属性 */
interface SettingsProviderProps {
  /** 子元素 */
  children: ReactNode;
}

/**
 * 站点设置 Provider
 * 在应用顶层包裹，提供站点设置全局访问
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { data: settings } = usePublicSettings();

  return (
    <SettingsContext.Provider value={settings ?? defaultSettings}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * 获取站点设置的 Hook
 * @returns 站点设置对象
 */
export function useSiteSettings(): SiteSettings {
  return useContext(SettingsContext);
}