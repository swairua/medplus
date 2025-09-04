import { Building2 } from 'lucide-react';
import { BiolegendLogo } from '@/components/ui/biolegend-logo';

export function BiolegendHeader() {
  return (
    <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
      <div className="flex items-center space-x-3">
        <BiolegendLogo size="md" showText={true} className="text-primary-foreground" />
      </div>
      
      <div className="text-right text-sm">
        <div className="font-semibold">MEDPLUS AFRICA</div>
        <div className="text-xs opacity-90">&nbsp;</div>
        <div className="text-xs opacity-90">&nbsp;</div>
        <div className="text-xs opacity-90">info@medplusafrica.com</div>
        <div className="text-xs opacity-90">&nbsp;</div>
      </div>
    </div>
  );
}

export function BiolegendCompanyInfo() {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-semibold">MEDPLUS AFRICA</span>
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        <div>&nbsp;</div>
        <div>Email: info@medplusafrica.com</div>
        <div className="text-xs italic text-primary/70">&nbsp;</div>
      </div>
    </div>
  );
}
