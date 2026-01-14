import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ExternalLink,
  Globe,
  Wifi,
  Phone,
  CreditCard,
  ShoppingBag,
  Zap,
  Link as LinkIcon,
  Loader2
} from "lucide-react";

export interface WebService {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface WebServicesManagerProps {
  webServices: WebService[];
  onAdd: (data: Omit<WebService, "id" | "store_id" | "created_at" | "updated_at">) => Promise<WebService | void>;
  onUpdate: (id: string, data: Partial<WebService>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ICON_OPTIONS = [
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "globe", label: "Globe", icon: Globe },
  { value: "wifi", label: "Wifi/Data", icon: Wifi },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "credit-card", label: "Payment", icon: CreditCard },
  { value: "shopping-bag", label: "Shopping", icon: ShoppingBag },
  { value: "zap", label: "Quick Service", icon: Zap },
];

const getIconComponent = (iconName: string) => {
  const option = ICON_OPTIONS.find(o => o.value === iconName);
  return option?.icon || LinkIcon;
};

interface ServiceFormData {
  name: string;
  description: string;
  url: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

const WebServicesManager = ({ webServices, onAdd, onUpdate, onDelete }: WebServicesManagerProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<WebService | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: "",
    description: "",
    url: "",
    icon: "link",
    is_active: true,
    display_order: 0,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      url: "",
      icon: "link",
      is_active: true,
      display_order: webServices.length,
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (service: WebService) => {
    setFormData({
      name: service.name,
      description: service.description || "",
      url: service.url,
      icon: service.icon,
      is_active: service.is_active,
      display_order: service.display_order,
    });
    setEditingService(service);
  };

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.url.trim()) return;
    
    // Ensure URL has protocol
    let url = formData.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    if (!validateUrl(url)) {
      return;
    }

    setLoading(true);
    try {
      if (editingService) {
        await onUpdate(editingService.id, { ...formData, url });
        setEditingService(null);
      } else {
        await onAdd({ ...formData, url });
        setIsAddDialogOpen(false);
      }
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await onDelete(id);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (service: WebService) => {
    await onUpdate(service.id, { is_active: !service.is_active });
  };

  const ServiceForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="serviceName">Service Name *</Label>
        <Input
          id="serviceName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Buy Data Bundles"
          className="mt-1"
          maxLength={100}
        />
      </div>
      
      <div>
        <Label htmlFor="serviceUrl">URL *</Label>
        <Input
          id="serviceUrl"
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://example.com"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The link customers will visit when they click
        </p>
      </div>

      <div>
        <Label htmlFor="serviceDescription">Description (optional)</Label>
        <Textarea
          id="serviceDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Purchase affordable data bundles for all networks"
          className="mt-1"
          maxLength={200}
        />
      </div>

      <div>
        <Label>Icon</Label>
        <Select
          value={formData.icon}
          onValueChange={(value) => setFormData({ ...formData, icon: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={loading || !formData.name.trim() || !formData.url.trim()}
        className="w-full"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {editingService ? "Save Changes" : "Add Service"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Web Services</h3>
          <p className="text-sm text-muted-foreground">
            Add external links for services you offer (e.g., data reselling)
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAdd} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Web Service</DialogTitle>
            </DialogHeader>
            <ServiceForm />
          </DialogContent>
        </Dialog>
      </div>

      {webServices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No web services added yet. Add links to external services you offer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webServices.map((service) => {
            const Icon = getIconComponent(service.icon);
            return (
              <Card key={service.id} className={!service.is_active ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{service.name}</h4>
                        {!service.is_active && (
                          <span className="text-xs text-muted-foreground">(Hidden)</span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {service.description}
                        </p>
                      )}
                      <a 
                        href={service.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {new URL(service.url).hostname}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => handleToggleActive(service)}
                      />
                      <Dialog open={editingService?.id === service.id} onOpenChange={(open) => !open && setEditingService(null)}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleOpenEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Web Service</DialogTitle>
                          </DialogHeader>
                          <ServiceForm />
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{service.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(service.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WebServicesManager;
