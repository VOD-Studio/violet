import { motion } from "motion/react";

export default function Hero() {
    return (
        <div className="relative w-full h-[100vh] flex items-center justify-center overflow-hidden bg-background">
            {/* Mock Aurora Background */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob [animation-delay:2s]" />
            </div>

            <div className="z-10 text-center flex flex-col items-center">
                <motion.h1
                    initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="text-6xl md:text-8xl font-black tracking-tighter mb-4"
                >
                    MIMO BLOG
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 1 }}
                    className="text-lg text-foreground/60 tracking-widest uppercase font-mono"
                >
                    Building the new way
                </motion.p>
            </div>

            <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-10 flex flex-col items-center opacity-50"
            >
                <span className="text-xs mb-2">Scroll</span>
                <div className="w-[1px] h-8 bg-foreground" />
            </motion.div>
        </div>
    );
}
