import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHelpAudience } from "@/hooks/useHelpAudience";
import { toYouTubeEmbed, isYouTubeShorts } from "@/lib/youtube";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, HelpCircle, Search } from "lucide-react";
import { Helmet } from "react-helmet-async";

type Topic = {
  id: string;
  title: string;
  sort_order: number;
  help_problems: Problem[];
};
type Problem = {
  id: string;
  title: string;
  youtube_url: string | null;
  steps_html: string;
  sort_order: number;
};

const AUDIENCE_LABELS: Record<string, string> = {
  buyer: "Buyer Help",
  seller: "Seller Help",
  delivery: "Delivery Help",
};

export default function Help() {
  const { audience, loading: audienceLoading } = useHelpAudience();
  const [query, setQuery] = useState("");

  const { data: topics, isLoading } = useQuery({
    queryKey: ["help-topics", audience],
    enabled: !audienceLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_topics")
        .select("id, title, sort_order, help_problems(id, title, youtube_url, steps_html, sort_order)")
        .eq("audience", audience)
        .order("sort_order", { ascending: true })
        .order("sort_order", { ascending: true, foreignTable: "help_problems" });
      if (error) throw error;
      return (data || []) as Topic[];
    },
  });

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics
      .map((t) => ({
        ...t,
        help_problems: t.help_problems.filter(
          (p) => p.title.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
        ),
      }))
      .filter((t) => t.title.toLowerCase().includes(q) || t.help_problems.length > 0);
  }, [topics, query]);

  const title = AUDIENCE_LABELS[audience] || "Help";

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>{title} | Shodel</title>
        <meta name="description" content={`Help and tutorials for ${audience}s on Shodel.`} />
      </Helmet>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">Tutorials and answers tailored to your account.</p>
          </div>
        </div>

        <div className="relative mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics or problems..."
            className="pl-9"
          />
        </div>

        <div className="mt-6">
          {audienceLoading || isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No help articles yet for {audience}s.</p>
                <p className="text-xs mt-1">Check back soon.</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filtered.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg bg-card px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">{topic.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {topic.help_problems.length} {topic.help_problems.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {topic.help_problems.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No problems under this topic yet.</p>
                    ) : (
                      <div className="space-y-6 py-2">
                        {topic.help_problems.map((p) => (
                          <ProblemView key={p.id} problem={p} />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemView({ problem }: { problem: Problem }) {
  const embed = toYouTubeEmbed(problem.youtube_url);
  const isShorts = isYouTubeShorts(problem.youtube_url);
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-semibold mb-3">{problem.title}</h3>
      {embed && (
        <div
          className={`relative w-full mb-3 rounded-lg overflow-hidden bg-black ${
            isShorts ? "max-w-xs mx-auto aspect-[9/16]" : "aspect-video"
          }`}
        >
          <iframe
            src={embed}
            title={problem.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      )}
      {problem.steps_html && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(problem.steps_html) }}
        />
      )}
    </div>
  );
}
