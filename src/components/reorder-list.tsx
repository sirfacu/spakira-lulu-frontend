import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props<T extends { id: string }> = {
  items: T[];
  onReorder: (next: T[]) => void;
  className?: string;
  disabled?: boolean;
  /** Render each item; dragHandleProps go on a non-button element (div/span). */
  renderItem: (
    item: T,
    ctx: {
      index: number;
      isDragging: boolean;
      isOver: boolean;
      dragHandleProps: {
        draggable: boolean;
        onDragStart: (e: DragEvent) => void;
        onDragEnd: (e: DragEvent) => void;
      };
    },
  ) => ReactNode;
};

/**
 * Lista/grid reordenable con HTML5 DnD.
 * Importante: el handle NO debe ser <button> (Chrome ignora draggable en buttons).
 */
export function ReorderList<T extends { id: string }>({
  items,
  onReorder,
  className,
  disabled,
  renderItem,
}: Props<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const move = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const from = items.findIndex((i) => i.id === fromId);
      const to = items.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return;
      const next = items.slice();
      const [row] = next.splice(from, 1);
      if (!row) return;
      next.splice(to, 0, row);
      onReorder(next);
    },
    [items, onReorder],
  );

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div
          key={item.id}
          onDragOver={(e) => {
            if (disabled || !dragIdRef.current) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overId !== item.id) setOverId(item.id);
          }}
          onDrop={(e) => {
            if (disabled || !dragIdRef.current) return;
            e.preventDefault();
            move(dragIdRef.current, item.id);
            dragIdRef.current = null;
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "h-full min-h-0",
            overId === item.id && dragId && dragId !== item.id
              ? "ring-2 ring-primary/40 ring-offset-2 rounded-2xl"
              : "",
          )}
        >
          {renderItem(item, {
            index,
            isDragging: dragId === item.id,
            isOver: overId === item.id && dragId !== item.id,
            dragHandleProps: {
              draggable: !disabled,
              onDragStart: (e) => {
                if (disabled) {
                  e.preventDefault();
                  return;
                }
                dragIdRef.current = item.id;
                setDragId(item.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
                // Evita que un <button> padre capture el gesto
                e.stopPropagation();
              },
              onDragEnd: () => {
                dragIdRef.current = null;
                setDragId(null);
                setOverId(null);
              },
            },
          })}
        </div>
      ))}
    </div>
  );
}
