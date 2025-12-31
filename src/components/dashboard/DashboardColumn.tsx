import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { DashboardCardId } from "@/hooks/useDashboardLayout";

interface DashboardColumnProps {
  id: string;
  items: DashboardCardId[];
  children: React.ReactNode;
  className?: string;
}

export const DashboardColumn = ({
  id,
  items,
  children,
  className,
}: DashboardColumnProps) => {
  const { setNodeRef, isOver, active } = useDroppable({ id });

  // Check if the dragged item is from a different column
  const activeId = active?.id as DashboardCardId | undefined;
  const isFromDifferentColumn = activeId && !items.includes(activeId);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-6 min-h-[200px] rounded-xl p-2 -m-2 transition-all duration-300",
        isOver && isFromDifferentColumn && [
          "bg-gradient-to-b from-primary/5 to-primary/10",
          "ring-2 ring-primary/30 ring-dashed",
          "shadow-inner shadow-primary/5",
        ],
        isOver && !isFromDifferentColumn && "bg-muted/30",
        className
      )}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {children}
        </div>
      </SortableContext>
      
      {/* Drop indicator when empty or at bottom */}
      {isOver && isFromDifferentColumn && (
        <div className="h-2 bg-primary/20 rounded-full animate-pulse mx-4" />
      )}
    </div>
  );
};
