# ImagePreview 组件

可复用的图片预览组件，支持全屏预览、缩放、多图切换和键盘操作。

## 文件清单

- `ImagePreview.tsx` - 主组件和 Hook
- `ImagePreview.example.tsx` - 使用示例代码
- `ImagePreview.README.md` - 完整文档
- `../pages/demo/ImagePreviewDemo.tsx` - 可视化演示页面

## 快速开始

```tsx
import { useImagePreview, ImagePreview } from "@/components/shared";

function MyComponent() {
  const { open, images, currentIndex, triggerElement, openPreview, closePreview } =
    useImagePreview();

  return (
    <>
      <img 
        src="image.jpg" 
        onClick={(e) => openPreview(["image.jpg"], 0, e.currentTarget)} 
      />
      <ImagePreview
        open={open}
        onClose={closePreview}
        images={images}
        currentIndex={currentIndex}
        triggerElement={triggerElement}
      />
    </>
  );
}
```

## 主要特性

- ✓ 全屏预览
- ✓ 缩放控制（0.5x - 3x）
- ✓ 多图切换
- ✓ 键盘操作（ESC/←→/+/-）
- ✓ 平滑动画
- ✓ 懒加载优化

详细文档请查看 `ImagePreview.README.md`。
