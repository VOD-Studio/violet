import { useState, useEffect, type RefObject } from "react";

interface Position {
  top: number;
  left: number;
}

interface UsePopoverPositionOptions {
  isOpen: boolean;
  buttonRef: RefObject<HTMLElement | null>;
  pickerWidth?: number;
  pickerHeight?: number;
}

export function usePopoverPosition({
  isOpen,
  buttonRef,
  pickerWidth = 320,
  pickerHeight = 400,
}: UsePopoverPositionOptions) {
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();

    // 计算位置：优先显示在按钮上方
    let top = rect.top - pickerHeight - 8;
    let left = rect.left;

    // 如果上方空间不足，显示在下方
    if (top < 0) {
      top = rect.bottom + 8;
    }

    // 确保不超出右边界
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 16;
    }

    // 确保不超出左边界
    if (left < 16) {
      left = 16;
    }

    setPosition({ top, left });
  }, [isOpen, buttonRef, pickerWidth, pickerHeight]);

  return position;
}
