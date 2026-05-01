import { TocMobile } from "./TocMobile";
import { TocSidebar } from "./TocSidebar";
import { useToc } from "./useToc";

interface TableOfContentsProps {
  /** 最小标题级别，默认 2（h2） */
  minLevel?: number;
  /** 最大标题级别，默认 4（h4） */
  maxLevel?: number;
  /** 滚动吸附偏移，默认 88px（适配固定顶栏） */
  offsetTop?: number;
}

/**
 * 文章目录导航
 * - 桌面（≥xl）：右侧固定侧边栏，带进度指示线
 * - 移动（<xl）：右下角悬浮按钮 + 底部抽屉
 */
export function TableOfContents({
  minLevel = 2,
  maxLevel = 4,
  offsetTop = 88,
}: TableOfContentsProps) {
  const { headings, activeId, scrollTo } = useToc({
    minLevel,
    maxLevel,
    offsetTop,
  });

  return (
    <>
      <TocSidebar
        headings={headings}
        activeId={activeId}
        onSelect={scrollTo}
        minLevel={minLevel}
      />
      <TocMobile
        headings={headings}
        activeId={activeId}
        onSelect={scrollTo}
        minLevel={minLevel}
      />
    </>
  );
}
