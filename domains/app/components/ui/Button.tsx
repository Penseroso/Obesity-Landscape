import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-xs hover:opacity-90",
  outline:
    "border border-border bg-card text-card-foreground shadow-xs hover:bg-muted",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-muted",
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-3.5 py-2 text-sm",
};

type ButtonVariantsOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * Class-string generator so a non-<button> element (e.g. an <a> styled as a
 * button, like Company Detail's "Official website"/"Official pipeline"
 * links) can share the exact same recipe as <Button> without a polymorphic
 * `asChild` wrapper.
 */
export function buttonVariants({
  variant = "outline",
  size = "md",
  className = "",
}: ButtonVariantsOptions = {}): string {
  return [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-semibold transition",
    variantClassName[variant],
    sizeClassName[size],
    focusRing,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "outline",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    />
  );
}
