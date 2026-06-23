import { cn } from "@/shared/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-secondary",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--glow-soft) / 0.12), transparent)",
          animation: "nexus-shimmer 1.6s ease-in-out infinite",
        }}
      />
    </div>
  )
}

export { Skeleton }
