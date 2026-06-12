
CREATE TABLE public.reconciliation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  transactions_checked integer NOT NULL DEFAULT 0,
  paystack_calls integer NOT NULL DEFAULT 0,
  mismatches_found integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reconciliation_runs TO authenticated;
GRANT ALL ON public.reconciliation_runs TO service_role;

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reconciliation runs"
ON public.reconciliation_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.reconciliation_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  user_id uuid,
  transaction_id uuid,
  order_id uuid,
  payment_reference text,
  expected_amount numeric,
  actual_amount numeric,
  details jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_issues_run ON public.reconciliation_issues(run_id);
CREATE INDEX idx_reconciliation_issues_unresolved ON public.reconciliation_issues(resolved) WHERE resolved = false;

GRANT SELECT, UPDATE ON public.reconciliation_issues TO authenticated;
GRANT ALL ON public.reconciliation_issues TO service_role;

ALTER TABLE public.reconciliation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reconciliation issues"
ON public.reconciliation_issues FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins resolve reconciliation issues"
ON public.reconciliation_issues FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
