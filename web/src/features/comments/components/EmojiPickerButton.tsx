import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import { usePopoverPosition } from "../hooks/usePopoverPosition";

interface EmojiPickerButtonProps {
  onSelect: (syntax: string) => void;
  className?: string;
}

export function EmojiPickerButton({
  onSelect,
  className,
}: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const position = usePopoverPosition({
    isOpen,
    buttonRef,
    pickerWidth: 320,
    pickerHeight: 400,
  });

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-center size-8 rounded-lg",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "transition-colors",
          isOpen && "text-foreground bg-muted",
          className,
        )}
        title="选择表情"
      >
        <Smile className="size-5" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-50"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            <EmojiPicker onSelect={onSelect} onClose={handleClose} />
          </div>,
          document.body,
        )}
    </>
  );
}
