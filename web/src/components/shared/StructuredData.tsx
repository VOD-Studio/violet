// JSON-LD 结构化数据组件
// 通过 script 标签注入结构化数据，帮助搜索引擎理解页面内容
// 支持 BlogPosting、Person、WebSite、BreadcrumbList 四种 schema 类型

import { useEffect } from "react";

/** 结构化数据组件属性 */
interface StructuredDataProps {
  /** JSON-LD 数据对象，支持单个或多个 schema */
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * 结构化数据组件
 * 将 JSON-LD 数据以 script[type="application/ld+json"] 的形式注入到 document.head
 * 组件卸载时自动清理
 *
 * @param data JSON-LD 数据对象或数组
 */
export function StructuredData({ data }: StructuredDataProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-structured-data", "true");
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    /* 组件卸载时移除脚本标签 */
    return () => {
      script.remove();
    };
  }, [data]);

  /* 该组件不渲染任何 DOM 元素 */
  return null;
}

/**
 * 清理所有由 StructuredData 组件注入的脚本标签
 * 通常不需要手动调用，组件卸载时会自动清理
 */
export function cleanupStructuredData() {
  const scripts = document.head.querySelectorAll("[data-structured-data]");
  for (const script of scripts) {
    script.remove();
  }
}
