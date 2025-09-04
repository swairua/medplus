import { cn } from "@/lib/utils";

interface BiolegendLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function BiolegendLogo({ className, size = "md", showText = true }: BiolegendLogoProps) {
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-16 w-16",
    lg: "h-20 w-20"
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl"
  };

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      {/* Biolegend Logo Image */}
      <div className={cn("relative", sizeClasses[size])}>
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2Ffd1c9d5781fc4f20b6ad16683f5b85b3%2F274fc62c033e464584b0f50713695127?format=webp&width=800"
          alt="Medplus Africa Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Company Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-bold text-primary", textSizeClasses[size])}>
            MEDPLUS
          </span>
          <span className={cn("text-xs text-secondary font-medium -mt-1", size === "sm" && "text-[10px]")}>
            AFRICA
          </span>
        </div>
      )}
    </div>
  );
}
