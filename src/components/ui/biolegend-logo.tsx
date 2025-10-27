import { cn } from "@/lib/utils";

interface BiolegendLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

import { useCurrentCompany } from '@/contexts/CompanyContext';

export function BiolegendLogo({ className, size = "md", showText = true }: BiolegendLogoProps) {
  const { currentCompany } = useCurrentCompany();

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

  const logoSrc = currentCompany?.logo_url ||
    '/public/placeholder.svg';

  const companyName = currentCompany?.name || 'MEDPLUS';

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      {/* Company Logo Image (falls back to default) */}
      <div className={cn("relative", sizeClasses[size])}>
        <img
          src={logoSrc}
          alt={`${companyName} Logo`}
          className="w-full h-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).src = '/public/placeholder.svg'; }}
        />
      </div>

      {/* Company Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-bold text-primary", textSizeClasses[size])}>
            {companyName.split(' ')[0].toUpperCase()}
          </span>
          <span className={cn("text-xs text-secondary font-medium -mt-1", size === "sm" && "text-[10px]")}>
            {companyName.split(' ')[1]?.toUpperCase() || ''}
          </span>
        </div>
      )}
    </div>
  );
}
