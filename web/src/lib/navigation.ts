// 全局导航管理
// 用于在 React 组件外部（如 axios 拦截器）执行路由跳转
// 不使用 window.location.href 以避免页面刷新导致 network 日志丢失

import type { NavigateFunction } from "react-router";

/** 全局 navigate 函数引用 */
let navigate: NavigateFunction | null = null;

/**
 * 设置全局 navigate 函数
 * 在 App 组件初始化时调用
 */
export function setNavigate(fn: NavigateFunction) {
  navigate = fn;
}

/**
 * 获取全局 navigate 函数
 * 用于非 React 组件中执行路由跳转
 */
export function getNavigate(): NavigateFunction | null {
  return navigate;
}
