import { Button } from "@/components/ui/button";
import { Smartphone, Download } from "lucide-react";
import { Link } from "react-router-dom";

const DownloadBanner = () => {
  return (
    <section className="py-6 md:py-8">
      <div className="container px-4">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6 max-w-3xl mx-auto p-5 md:p-6 rounded-2xl bg-accent/50 border border-primary/10">
          <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4 text-center md:text-left">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Get the Jayee Express App</h3>
              <p className="text-sm text-muted-foreground">Shop and sell on the go</p>
            </div>
          </div>
          <Link to="/download" className="w-full md:w-auto">
            <Button variant="hero" size="default" className="gap-2 w-full md:w-auto rounded-xl">
              <Download className="h-4 w-4" />
              Download Now
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DownloadBanner;
