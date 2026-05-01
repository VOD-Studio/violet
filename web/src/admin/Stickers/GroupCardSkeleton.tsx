import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GroupCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
