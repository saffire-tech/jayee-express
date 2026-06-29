import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { toYouTubeEmbed } from "@/lib/youtube";

type Audience = "buyer" | "seller" | "delivery";
type Problem = {
  id: string; topic_id: string; title: string; youtube_url: string | null;
  steps_html: string; sort_order: number;
};
type Topic = {
  id: string; audience: Audience; title: string; sort_order: number;
  help_problems: Problem[];
};

export default function HelpManagement() {
  const [audience, setAudience] = useState<Audience>("buyer");
  const qc = useQueryClient();

  const { data: topics, isLoading } = useQuery({
    queryKey: ["admin-help-topics", audience],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_topics")
        .select("id, audience, title, sort_order, help_problems(id, topic_id, title, youtube_url, steps_html, sort_order)")
        .eq("audience", audience)
        .order("sort_order", { ascending: true })
        .order("sort_order", { ascending: true, foreignTable: "help_problems" });
      if (error) throw error;
      return (data || []) as Topic[];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-help-topics", audience] });

  const moveTopic = useMutation({
    mutationFn: async ({ topic, dir }: { topic: Topic; dir: -1 | 1 }) => {
      const list = (topics || []).slice();
      const idx = list.findIndex((t) => t.id === topic.id);
      const swap = list[idx + dir];
      if (!swap) return;
      await Promise.all([
        supabase.from("help_topics").update({ sort_order: swap.sort_order }).eq("id", topic.id),
        supabase.from("help_topics").update({ sort_order: topic.sort_order }).eq("id", swap.id),
      ]);
    },
    onSuccess: invalidate,
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("help_topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Topic deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProblem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("help_problems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Problem deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Help Center" description="Manage tutorials shown to buyers, sellers, and riders">
      <Tabs value={audience} onValueChange={(v) => setAudience(v as Audience)}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="buyer">Buyer</TabsTrigger>
            <TabsTrigger value="seller">Seller</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
          </TabsList>
          <TopicDialog
            audience={audience}
            nextSortOrder={(topics?.length || 0) + 1}
            onSaved={invalidate}
            trigger={
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Topic</Button>
            }
          />
        </div>

        <TabsContent value={audience} className="mt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (topics || []).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No topics yet for {audience}s.</CardContent></Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {topics!.map((topic, idx) => (
                <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg bg-card px-4">
                  <div className="flex items-center justify-between gap-2 py-1">
                    <AccordionTrigger className="flex-1 hover:no-underline py-2">
                      <div className="text-left">
                        <div className="font-medium">{topic.title}</div>
                        <div className="text-xs text-muted-foreground">{topic.help_problems.length} problem{topic.help_problems.length !== 1 ? "s" : ""}</div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => moveTopic.mutate({ topic, dir: -1 })}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" disabled={idx === topics!.length - 1} onClick={() => moveTopic.mutate({ topic, dir: 1 })}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <TopicDialog audience={audience} topic={topic} onSaved={invalidate}
                        trigger={<Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>}
                      />
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Delete topic "${topic.title}" and all its problems?`)) deleteTopic.mutate(topic.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="flex justify-end mb-3">
                      <ProblemDialog
                        topicId={topic.id}
                        nextSortOrder={(topic.help_problems.length || 0) + 1}
                        onSaved={invalidate}
                        trigger={<Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add Problem</Button>}
                      />
                    </div>
                    {topic.help_problems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No problems yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {topic.help_problems.map((p) => (
                          <div key={p.id} className="border rounded-md p-3 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{p.title}</div>
                              {p.youtube_url && (
                                <div className="text-xs text-muted-foreground truncate">{p.youtube_url}</div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <ProblemDialog
                                topicId={topic.id}
                                problem={p}
                                onSaved={invalidate}
                                trigger={<Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>}
                              />
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm(`Delete "${p.title}"?`)) deleteProblem.mutate(p.id);
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function TopicDialog({
  audience, topic, nextSortOrder, onSaved, trigger,
}: {
  audience: Audience; topic?: Topic; nextSortOrder?: number;
  onSaved: () => void; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(topic?.title || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      if (topic) {
        const { error } = await supabase.from("help_topics").update({ title: title.trim() }).eq("id", topic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("help_topics").insert({
          audience, title: title.trim(), sort_order: nextSortOrder || 1,
        });
        if (error) throw error;
      }
      toast.success(topic ? "Topic updated" : "Topic created");
      setOpen(false);
      if (!topic) setTitle("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && topic) setTitle(topic.title); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{topic ? "Edit Topic" : "New Topic"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to upload a product" maxLength={200} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProblemDialog({
  topicId, problem, nextSortOrder, onSaved, trigger,
}: {
  topicId: string; problem?: Problem; nextSortOrder?: number;
  onSaved: () => void; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(problem?.title || "");
  const [youtube, setYoutube] = useState(problem?.youtube_url || "");
  const [steps, setSteps] = useState(problem?.steps_html || "");
  const [saving, setSaving] = useState(false);

  const youtubePreview = toYouTubeEmbed(youtube);
  const youtubeError = youtube.trim() && !youtubePreview;

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (youtubeError) { toast.error("Invalid YouTube URL"); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        youtube_url: youtube.trim() || null,
        steps_html: steps,
      };
      if (problem) {
        const { error } = await supabase.from("help_problems").update(payload).eq("id", problem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("help_problems").insert({
          ...payload, topic_id: topicId, sort_order: nextSortOrder || 1,
        });
        if (error) throw error;
      }
      toast.success(problem ? "Problem updated" : "Problem created");
      setOpen(false);
      if (!problem) { setTitle(""); setYoutube(""); setSteps(""); }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o && problem) { setTitle(problem.title); setYoutube(problem.youtube_url || ""); setSteps(problem.steps_html); }
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{problem ? "Edit Problem" : "New Problem"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Uploading product images" />
          </div>
          <div className="space-y-2">
            <Label>YouTube URL (optional)</Label>
            <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/watch?v=... or /shorts/..." />
            {youtubeError && <p className="text-xs text-destructive">Could not detect a YouTube video ID.</p>}
            {youtubePreview && (
              <div className="aspect-video rounded-md overflow-hidden bg-black">
                <iframe src={youtubePreview} title="preview" allowFullScreen className="w-full h-full" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Steps</Label>
            <RichTextEditor value={steps} onChange={setSteps} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
