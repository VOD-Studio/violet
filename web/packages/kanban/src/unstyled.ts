export type { BoardColumn, BoardProps, NewCard } from "./board/board.tsx";
export { Board } from "./board/board.tsx";
export type { PointerControllerOptions } from "./board/drag/pointer-controller.ts";
export { createPointerController } from "./board/drag/pointer-controller.ts";
export type { DragController, DragHost } from "./board/drag/types.ts";
export type { MoveDecision } from "./board/drag/use-board-moves.ts";
export type { InlineEditMessages, InlineEditProps } from "./board/inline-edit.tsx";
export { InlineEdit } from "./board/inline-edit.tsx";
export type { BoardLocale, BoardMessages } from "./board/messages.ts";
export type { RelationListProps } from "./board/relations/relation-list.tsx";
export { RelationList } from "./board/relations/relation-list.tsx";
export type { RelationLine, RelationTypeStyle } from "./board/relations/types.ts";
export type {
	BoardCard,
	BoardMove,
	BoardPosition,
	BoardState,
	CommandHistory,
	HistoryCommand,
	HistoryOptions,
	HistoryOutcome,
	HistoryResult,
	HistoryState,
} from "./core/index.ts";
export { createHistory } from "./core/index.ts";
export type { HistoryButtonsProps } from "./history/history-buttons.tsx";
export { HistoryButtons } from "./history/history-buttons.tsx";
export type { HistoryMessages } from "./history/messages.ts";
export type { HistoryAnnouncementOptions } from "./history/use-history-announcement.ts";
export { useHistoryAnnouncement } from "./history/use-history-announcement.ts";
export type { HistoryShortcutsOptions } from "./history/use-history-shortcuts.ts";
export { useHistoryShortcuts } from "./history/use-history-shortcuts.ts";
export { useHistoryState } from "./history/use-history-state.ts";
