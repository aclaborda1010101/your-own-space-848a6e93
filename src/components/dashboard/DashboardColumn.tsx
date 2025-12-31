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
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-6 min-h-[200px] rounded-lg transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/20 ring-dashed",
        className
      )}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
};
