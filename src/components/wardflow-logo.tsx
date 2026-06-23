import Image from "next/image";
import { cn } from "@/lib/utils";

export function WardFlowLogo({
  className,
  imageClassName,
  sizes = "56px",
  priority = false,
}: {
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] ring-1 ring-[color:var(--color-rule)] shadow-lg shadow-[color:var(--color-shadow-soft)]",
        className,
      )}
    >
      <Image
        src="/icon.png"
        alt="WardFlow logo"
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
