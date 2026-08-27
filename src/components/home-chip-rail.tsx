import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Carril horizontal con autoplay suave + flechas para ir adelante/atrás. */
export function ChipRail({
  children,
  className = "",
  autoplay = true,
  stepPx = 300,
}: {
  children: ReactNode;
  className?: string;
  autoplay?: boolean;
  /** Cuánto avanza cada click / tick de autoplay. */
  stepPx?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pauseUntilRef = useRef(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const items = Children.toArray(children);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
  }, []);

  const pauseAuto = useCallback((ms = 6000) => {
    pauseUntilRef.current = Date.now() + ms;
  }, []);

  const scrollByDir = useCallback(
    (dir: -1 | 1) => {
      const el = scrollerRef.current;
      if (!el) return;
      pauseAuto();
      const max = el.scrollWidth - el.clientWidth;
      let next = el.scrollLeft + dir * stepPx;
      if (next < 0) next = max;
      if (next > max) next = 0;
      el.scrollTo({ left: next, behavior: "smooth" });
    },
    [pauseAuto, stepPx],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, items.length]);

  useEffect(() => {
    if (!autoplay || items.length < 2) return;
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atEnd = el.scrollLeft >= max - 8;
      el.scrollTo({
        left: atEnd ? 0 : el.scrollLeft + stepPx,
        behavior: "smooth",
      });
    }, 3500);
    return () => window.clearInterval(id);
  }, [autoplay, items.length, stepPx]);

  if (items.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        className="home-chip-scroller flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={() => pauseAuto()}
        onWheel={() => pauseAuto()}
        onTouchStart={() => pauseAuto()}
      >
        {items.map((child, i) => (
          <div key={i} className="shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Anterior"
          disabled={!canPrev && items.length < 2}
          className="pointer-events-auto h-10 w-10 rounded-full border border-border bg-card/95 shadow-soft disabled:opacity-40"
          onClick={() => scrollByDir(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Siguiente"
          disabled={!canNext && items.length < 2}
          className="pointer-events-auto h-10 w-10 rounded-full border border-border bg-card/95 shadow-soft disabled:opacity-40"
          onClick={() => scrollByDir(1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
