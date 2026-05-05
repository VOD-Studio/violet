export interface ImagePreviewProps {
  /** 是否显示预览 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 图片列表 */
  images: string[];
  /** 当前显示的图片索引 */
  currentIndex?: number;
  /** 索引变化回调 */
  onIndexChange?: (index: number) => void;
  /** 触发预览的原始图片元素（用于计算动画起点） */
  triggerElement?: HTMLElement | null;
}
