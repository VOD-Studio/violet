import { useAudioStore } from "@features/music/model/audio-store";
import { useMusicUIStore } from "@features/music/model/ui-store";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * MusicPlayer - 悬浮音乐播放器胶囊（Nexus 视觉）
 */
const MusicPlayer = () => {
    const { isOpen, close } = useMusicUIStore();
    const { isPlaying, toggle, currentTrack } = useAudioStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <button
                        type="button"
                        onClick={toggle}
                        className={`flex items-center gap-2 rounded-full border border-edge-hairline px-4 py-2 backdrop-blur-md transition-all ${
                            isPlaying ? "bg-foreground/10" : "bg-background/80 dark:bg-zinc-900/80"
                        }`}
                    >
                        <div className="flex h-3 w-3 items-center justify-center overflow-hidden rounded-full bg-foreground">
                            {isPlaying && (
                                <motion.div className="h-full w-full animate-pulse bg-blue-500 blur-[2px]" />
                            )}
                        </div>
                        <span className="text-xs font-medium">
                            {isPlaying
                                ? currentTrack
                                    ? `${currentTrack.name} - ${currentTrack.artist}`
                                    : "Playing..."
                                : "Play"}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={close}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-edge-hairline bg-background/80 dark:bg-zinc-900/80 backdrop-blur-md transition-colors hover:bg-foreground/10"
                        aria-label="关闭"
                    >
                        <X className="size-4" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

export default MusicPlayer;
