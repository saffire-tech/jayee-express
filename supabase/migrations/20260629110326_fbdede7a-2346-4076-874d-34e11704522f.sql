CREATE TYPE public.help_audience AS ENUM ('buyer', 'seller', 'delivery');

CREATE TABLE public.help_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience public.help_audience NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_topics TO anon, authenticated;
GRANT ALL ON public.help_topics TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.help_topics TO authenticated;
ALTER TABLE public.help_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_topics readable by anyone" ON public.help_topics FOR SELECT USING (true);
CREATE POLICY "help_topics admin insert" ON public.help_topics FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "help_topics admin update" ON public.help_topics FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "help_topics admin delete" ON public.help_topics FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER help_topics_updated_at BEFORE UPDATE ON public.help_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_help_topics_audience_sort ON public.help_topics (audience, sort_order);

CREATE TABLE public.help_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.help_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  youtube_url text,
  steps_html text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_problems TO anon, authenticated;
GRANT ALL ON public.help_problems TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.help_problems TO authenticated;
ALTER TABLE public.help_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_problems readable by anyone" ON public.help_problems FOR SELECT USING (true);
CREATE POLICY "help_problems admin insert" ON public.help_problems FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "help_problems admin update" ON public.help_problems FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "help_problems admin delete" ON public.help_problems FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER help_problems_updated_at BEFORE UPDATE ON public.help_problems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_help_problems_topic_sort ON public.help_problems (topic_id, sort_order);