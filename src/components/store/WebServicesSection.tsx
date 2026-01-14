import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ExternalLink,
  Globe,
  Wifi,
  Phone,
  CreditCard,
  ShoppingBag,
  Zap,
  Link as LinkIcon,
} from "lucide-react";

interface WebService {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string;
}

interface WebServicesSectionProps {
  services: WebService[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  link: LinkIcon,
  globe: Globe,
  wifi: Wifi,
  phone: Phone,
  "credit-card": CreditCard,
  "shopping-bag": ShoppingBag,
  zap: Zap,
};

const WebServicesSection = ({ services }: WebServicesSectionProps) => {
  if (services.length === 0) return null;

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || LinkIcon;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Web Services</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => {
          const Icon = getIcon(service.icon);
          return (
            <Card 
              key={service.id}
              className="group hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {service.description}
                      </p>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(service.url, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default WebServicesSection;
