import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PostEditorState {
    zenMode: boolean;
    toggleZen: () => void;
    setZen: (v: boolean) => void;
}

export const usePostEditorStore = create<PostEditorState>()(
    persist(
        (set) => ({
            zenMode: false,
            toggleZen: () => set((s) => ({ zenMode: !s.zenMode })),
            setZen: (v) => set({ zenMode: v }),
        }),
        { name: "post-editor" },
    ),
);
