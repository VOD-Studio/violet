/**
 * ImagePreview 组件使用示例
 * 展示如何在实际场景中使用图片预览组件
 */

import { useState } from "react";
import { useImagePreview, ImagePreview } from ".";

/**
 * 示例 1: 单图预览
 */
export function SingleImageExample() {
  const {
    open,
    images,
    currentIndex,
    triggerElement,
    openPreview,
    closePreview,
  } = useImagePreview();

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    openPreview(["https://picsum.photos/800/600"], 0, e.currentTarget);
  };

  return (
    <div>
      <img
        src="https://picsum.photos/200/150"
        alt="示例图片"
        onClick={handleImageClick}
        className="cursor-pointer rounded-lg hover:opacity-80 transition-opacity"
      />

      <ImagePreview
        open={open}
        onClose={closePreview}
        images={images}
        currentIndex={currentIndex}
        triggerElement={triggerElement}
      />
    </div>
  );
}

/**
 * 示例 2: 多图画廊
 */
export function ImageGalleryExample() {
  const {
    open,
    images,
    currentIndex,
    triggerElement,
    openPreview,
    closePreview,
    setCurrentIndex,
  } = useImagePreview();

  const galleryImages = [
    "https://picsum.photos/800/600?random=1",
    "https://picsum.photos/800/600?random=2",
    "https://picsum.photos/800/600?random=3",
    "https://picsum.photos/800/600?random=4",
  ];

  const handleImageClick = (
    index: number,
    e: React.MouseEvent<HTMLImageElement>
  ) => {
    openPreview(galleryImages, index, e.currentTarget);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        {galleryImages.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`图片 ${index + 1}`}
            onClick={(e) => handleImageClick(index, e)}
            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          />
        ))}
      </div>

      <ImagePreview
        open={open}
        onClose={closePreview}
        images={images}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        triggerElement={triggerElement}
      />
    </div>
  );
}

/**
 * 示例 3: 评论中的图片预览
 */
export function CommentImageExample() {
  const {
    open,
    images,
    currentIndex,
    triggerElement,
    openPreview,
    closePreview,
    setCurrentIndex,
  } = useImagePreview();

  const commentImages = [
    "https://picsum.photos/400/300?random=5",
    "https://picsum.photos/400/300?random=6",
  ];

  const handleImageClick = (
    index: number,
    e: React.MouseEvent<HTMLImageElement>
  ) => {
    openPreview(commentImages, index, e.currentTarget);
  };

  return (
    <div className="p-4 border rounded-lg">
      <p className="mb-3 text-sm">这是一条带图片的评论内容...</p>

      <div className="flex gap-2">
        {commentImages.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`评论图片 ${index + 1}`}
            onClick={(e) => handleImageClick(index, e)}
            className="size-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
          />
        ))}
      </div>

      <ImagePreview
        open={open}
        onClose={closePreview}
        images={images}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        triggerElement={triggerElement}
      />
    </div>
  );
}

/**
 * 示例 4: 不使用 Hook 的方式（更灵活的控制）
 */
export function ManualControlExample() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const images = [
    "https://picsum.photos/800/600?random=7",
    "https://picsum.photos/800/600?random=8",
  ];

  const handleOpenPreview = (index: number) => {
    setPreviewImages(images);
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  return (
    <div>
      <div className="flex gap-4">
        {images.map((img, index) => (
          <button
            key={index}
            onClick={() => handleOpenPreview(index)}
            className="relative group"
          >
            <img
              src={img}
              alt={`图片 ${index + 1}`}
              className="size-30 object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
          </button>
        ))}
      </div>

      <ImagePreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        images={previewImages}
        currentIndex={previewIndex}
        onIndexChange={setPreviewIndex}
      />
    </div>
  );
}
