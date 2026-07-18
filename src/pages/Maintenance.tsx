import { motion } from "framer-motion";
import { Wrench, RefreshCw, Clock, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  eta: string | null;
}

export default function MaintenancePage({ message, eta }: Props) {
  const etaDate = eta ? new Date(eta) : null;
  const etaValid = etaDate && !isNaN(etaDate.getTime());

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-10 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl p-8 md:p-10 text-center">
          <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

          <motion.div
            animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }}
            className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          >
            <Wrench className="h-10 w-10" />
          </motion.div>

          <h1 className="relative text-3xl md:text-4xl font-bold tracking-tight">
            We'll be right back
          </h1>
          <p className="relative mt-3 text-muted-foreground text-base md:text-lg leading-relaxed">
            {message}
          </p>

          {etaValid && (
            <div className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Expected back</span>
              <span className="font-medium">
                {etaDate!.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}

          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()} className="w-full sm:w-auto gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <a
              href="https://www.instagram.com/jayeeexpress"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Instagram className="h-4 w-4" />
              Follow updates
            </a>
          </div>

          <div className="relative mt-8 text-xs text-muted-foreground">
            &mdash; Jayee Express &mdash;
          </div>
        </div>
      </motion.div>
    </main>
  );
}
