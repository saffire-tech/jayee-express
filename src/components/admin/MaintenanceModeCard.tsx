import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

export default function MaintenanceModeCard() {
  const remote = useMaintenanceMode();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!remote.loaded) return;
    setEnabled(remote.enabled);
    setMessage(remote.message);
    setEta(remote.eta ? remote.eta.slice(0, 16) : "");
  }, [remote.loaded, remote.enabled, remote.message, remote.eta]);

  const save = async (nextEnabled = enabled) => {
    setSaving(true);
    const value = JSON.stringify({
      enabled: nextEnabled,
      message: message.trim() || "We are performing scheduled maintenance. We'll be back shortly.",
      eta: eta ? new Date(eta).toISOString() : null,
    });
    const { error } = await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", "maintenance_mode");
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(nextEnabled ? "Maintenance mode ON" : "Maintenance mode OFF");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Maintenance Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">
              {enabled ? "App is under maintenance" : "App is live"}
            </div>
            <div className="text-sm text-muted-foreground">
              When ON, only admins can access the app.
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              save(v);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mm-msg">Message shown to users</Label>
          <Textarea
            id="mm-msg"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="We'll be back shortly..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mm-eta">Expected back (optional)</Label>
          <Input
            id="mm-eta"
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>

        <Button onClick={() => save()} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
