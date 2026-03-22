import * as Switch from "@radix-ui/react-switch";
import clsx from "clsx";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  size?: "default" | "sm";
}

export default function ToggleSwitch({
  checked,
  onCheckedChange,
  label = "",
  disabled = false,
  id = "toggle",
  size = "default",
}: ToggleProps) {
  const isSmall = size === "sm";

  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer select-none">
      {label && <span className="text-xs font-medium text-gray-400">{label}</span>}
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={clsx(
          "relative rounded-full transition-colors duration-200 outline-none cursor-pointer",
          isSmall ? "w-9 h-5 min-w-[36px] min-h-[20px]" : "w-12 h-6 min-w-[48px] min-h-[24px]",
          "focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--dark-bg))]",
          checked ? "bg-[hsl(var(--accent-primary))]" : "bg-gray-600/50",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Switch.Thumb
          className={clsx(
            "block rounded-full bg-gray-900 shadow-sm transition-transform duration-200 ease-out",
            isSmall ? "h-4 w-4 translate-y-0.5" : "h-5 w-5 translate-y-0.5",
            checked ? (isSmall ? "translate-x-[18px]" : "translate-x-6") : "translate-x-0.5"
          )}
        />
      </Switch.Root>
    </label>
  );
}
