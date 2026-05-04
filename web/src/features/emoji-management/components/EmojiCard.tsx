import { Button } from "@/components/ui/button";
import { getEmojiDisplay } from "@/hooks/useEmojisAdmin";
import { Trash2, Edit, Link, Type, Check } from "lucide-react";
import type { EmojiCardProps } from "../types";

export function EmojiCard({
  emoji,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
}: EmojiCardProps) {
  return (
    <div
      className={`group relative rounded-lg border p-1 transition-all duration-200 cursor-pointer
        ${isSelectMode ? "cursor-pointer" : ""}
        ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50 hover:shadow-sm"}
      `}
      onClick={isSelectMode ? onToggleSelect : undefined}
    >
      {isSelectMode && (
        <div className="absolute left-1 top-1 z-10">
          <div
            className={`size-5 rounded border-2 flex items-center justify-center transition-colors
              ${isSelected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/30"}
            `}
          >
            {isSelected && <Check className="size-3 text-primary-foreground" />}
          </div>
        </div>
      )}

      {emoji.url ? (
        <img
          src={getEmojiDisplay(emoji)}
          alt={emoji.name}
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div
          className="aspect-square w-full rounded flex items-center justify-center text-xl bg-muted"
          title={emoji.name}
        >
          {emoji.textContent || emoji.name}
        </div>
      )}

      {!isSelectMode && (
        <>
          <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="bg-background/90 backdrop-blur-sm"
            >
              <Edit className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="bg-background/90 backdrop-blur-sm text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>

          <div className="absolute bottom-1 left-1 right-1 hidden group-hover:block transition-opacity">
            <div className="flex items-center gap-0.5 rounded bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-xs">
              {emoji.url ? (
                <Link className="size-3 shrink-0" />
              ) : (
                <Type className="size-3 shrink-0" />
              )}
              <span className="truncate">{emoji.name}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
