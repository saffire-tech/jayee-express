import { Button } from "@/components/ui/button";
import { Smartphone, Download } from "lucide-react";
import { Link } from "react-router-dom";

const DownloadBanner = () => {
  return (
    <section className="py-8 md:py-12 bg-primary/5 border-y border-border">
      <div className="container px-4">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6 max-w-4xl mx-auto text-center md:text-left">
          <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
            <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-primary/10">
              <Smartphone className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-foreground">Get the Shodel App</h3>
              <p className="text-sm md:text-base text-muted-foreground">Shop and sell on the go. Download for iOS or Android.</p>
            </div>
          </div>
          <Link to="/download" className="w-full md:w-auto">
            <Button variant="hero" size="lg" className="gap-2 w-full md:w-auto">
              <Download className="h-4 w-4 md:h-5 md:w-5" />
              Download Now
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DownloadBanner;
