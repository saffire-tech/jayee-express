import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Mail } from "lucide-react";
import shodelLogoWhite from "@/assets/shodel-logo-white.png";

const Footer = () => {
  return (
    <footer className="bg-neutral-900 dark:bg-neutral-950 text-neutral-100 py-10 md:py-14">
      <div className="container px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <img src={shodelLogoWhite} alt="Jayee Express" className="h-9 w-auto mb-3" />
            <p className="text-neutral-400 text-sm mb-5 max-w-xs leading-relaxed">
              Connecting local entrepreneurs with buyers in your community.
            </p>
            <div className="flex items-center gap-2">
                {[
                  { Icon: Facebook, label: "Facebook", href: "#" },
                  { Icon: Twitter, label: "Twitter", href: "#" },
                  { Icon: Instagram, label: "Instagram", href: "https://www.instagram.com/jayeeexpress?utm_source=qr&igsh=ajM2bTFiN2J2dGw1" },
                  { Icon: Mail, label: "Email", href: "#" },
                ].map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={`Jayee Express on ${label}`}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-neutral-200">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { to: "/products", label: "Browse Products" },
                { to: "/stores", label: "Featured Stores" },
                { to: "/seller", label: "Become a Seller" },
                { to: "/download", label: "Download App" },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-neutral-400 hover:text-neutral-100 transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-neutral-200">Support</h4>
            <ul className="space-y-2">
              <li><Link to="/report-issue" className="text-neutral-400 hover:text-neutral-100 transition-colors text-sm">Report an Issue</Link></li>
              <li><Link to="/terms" className="text-neutral-400 hover:text-neutral-100 transition-colors text-sm">Safety Guidelines</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-neutral-200">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/terms" className="text-neutral-400 hover:text-neutral-100 transition-colors text-sm">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="text-neutral-400 hover:text-neutral-100 transition-colors text-sm">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-center">
          <p className="text-neutral-500 text-xs">
            © {new Date().getFullYear()} Jayee Express. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
