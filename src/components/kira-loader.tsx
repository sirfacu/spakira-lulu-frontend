/** Animación de carga Spa Kira: sticker Kira + "cargando tu experiencia". */

import { cn } from "@/lib/utils";

export const KIRA_LOADING_STICKER = "/spa-kira-cursores-web/kira-loading-sticker.png";

type Variant = "fullscreen" | "overlay" | "inline";

type Props = {
  variant?: Variant;
  label?: string;
  className?: string;
};

const floatStyle = {
  animation: "spakira-kira-float 1.4s ease-in-out infinite",
} as const;

const pinkSolid = { backgroundColor: "rgb(255, 245, 247)" } as const;
const pinkSoft = { backgroundColor: "rgba(255, 245, 247, 0.9)" } as const;

export function KiraLoader({
  variant = "inline",
  label = "cargando tu experiencia",
  className,
}: Props) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6",
        variant === "inline" && "py-10",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <img
        src={KIRA_LOADING_STICKER}
        alt=""
        className={
          variant === "inline"
            ? "h-20 w-20 select-none object-contain drop-shadow-sm"
            : "h-28 w-28 select-none object-contain drop-shadow-sm sm:h-32 sm:w-32"
        }
        style={floatStyle}
        draggable={false}
      />
      <p
        className={
          variant === "inline"
            ? "text-center font-script text-xl text-accent"
            : "text-center font-script text-2xl text-accent sm:text-3xl"
        }
      >
        {label}
      </p>
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center" style={pinkSolid}>
        {content}
        <KiraFloatKeyframes />
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-40 grid place-items-center backdrop-blur-sm"
        style={pinkSoft}
      >
        {content}
        <KiraFloatKeyframes />
      </div>
    );
  }

  return (
    <>
      {content}
      <KiraFloatKeyframes />
    </>
  );
}

function KiraFloatKeyframes() {
  return (
    <style>
      {
        "@keyframes spakira-kira-float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.04); } }"
      }
    </style>
  );
}
