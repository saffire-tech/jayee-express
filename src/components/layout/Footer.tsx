import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Mail } from "lucide-react";
import uniplugLogo from "@/assets/uniplug-logo.png";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-10 md:py-16">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mb-10 md:mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <img src={uniplugLogo} alt="Shodel" className="h-10 md:h-12 w-auto mb-4 brightness-0 invert" />
            <p className="text-background/70 mb-6 text-sm md:text-base">
              Connecting local entrepreneurs with buyers in your community. Buy, sell, and grow your hustle.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Facebook className="h-4 w-4 md:h-5 md:w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Twitter className="h-4 w-4 md:h-5 md:w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Instagram className="h-4 w-4 md:h-5 md:w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Mail className="h-4 w-4 md:h-5 md:w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-base md:text-lg mb-3 md:mb-4">Quick Links</h4>
            <ul className="space-y-2 md:space-y-3">
              <li><Link to="/products" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Browse Products</Link></li>
              <li><Link to="/stores" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Featured Stores</Link></li>
              <li><Link to="/seller" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Become a Seller</Link></li>
              <li><Link to="/download" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Download App</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-base md:text-lg mb-3 md:mb-4">Support</h4>
            <ul className="space-y-2 md:space-y-3">
              <li><Link to="/report-issue" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Report an Issue</Link></li>
              <li><Link to="/terms" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Safety Guidelines</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-base md:text-lg mb-3 md:mb-4">Legal</h4>
            <ul className="space-y-2 md:space-y-3">
              <li><Link to="/terms" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="text-background/70 hover:text-background transition-colors text-sm md:text-base">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 md:pt-8 border-t border-background/10 text-center">
          <p className="text-background/50 text-xs md:text-sm">
            © {new Date().getFullYear()} Uniplug. All rights reserved. Your Community Marketplace.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
