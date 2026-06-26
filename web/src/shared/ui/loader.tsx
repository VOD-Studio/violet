import { motion } from "motion/react";
import { cn } from "@shared/lib/utils";

export interface LoaderProps { label?: string; size?: "sm" | "md" | "lg"; className?: string; }

const Loader = ({ label, size = "md", className }: LoaderProps) => {
	const dotClass = size === "lg" ? "w-4 h-4" : size === "sm" ? "w-2 h-2" : "w-3 h-3";
	
	return (
		<div className={cn("flex flex-col items-center justify-center gap-4", className)} role="status">
			<div className="flex gap-2 filter contrast-150">
				{[0, 1, 2].map((i) => (
					<motion.div
						key={i}
						className={cn("bg-foreground rounded-full blur-[1px]", dotClass)}
						animate={{ y: ["0%", "-100%", "0%"], scale: [1, 1.2, 1] }}
						transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
					/>
				))}
			</div>
			{label && <p className="font-mono text-xs tracking-wider text-muted-foreground">{label}</p>}
		</div>
	);
};

export default Loader;
