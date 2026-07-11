import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextProps = HTMLAttributes<HTMLElement>;

export function H1({ className, ...props }: TextProps) {
  return (
    <h1
      className={cn(
        "text-foreground text-4xl font-semibold tracking-tight sm:text-5xl",
        className
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: TextProps) {
  return (
    <h2
      className={cn(
        "text-foreground text-3xl font-semibold tracking-tight sm:text-4xl",
        className
      )}
      {...props}
    />
  );
}

export function H3({ className, ...props }: TextProps) {
  return (
    <h3
      className={cn(
        "text-foreground text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export function H4({ className, ...props }: TextProps) {
  return (
    <h4
      className={cn("text-foreground text-lg font-semibold", className)}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: TextProps) {
  return (
    <p className={cn("text-muted-foreground text-lg", className)} {...props} />
  );
}

export function P({ className, ...props }: TextProps) {
  return (
    <p className={cn("text-foreground text-base", className)} {...props} />
  );
}

export function Large({ className, ...props }: TextProps) {
  return (
    <p
      className={cn("text-foreground text-lg font-medium", className)}
      {...props}
    />
  );
}

export function Small({ className, ...props }: TextProps) {
  return (
    <p
      className={cn("text-foreground text-sm font-medium", className)}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: TextProps) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)} {...props} />
  );
}
