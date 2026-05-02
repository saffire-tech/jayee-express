import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ShoppingCart, Store, User, LogOut, Shield, MessageCircle, Download, LogIn, Bell, Truck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useDeliveryRole } from "@/hooks/useDeliveryRole";
import GlobalSearch from "@/components/search/GlobalSearch";
import AnnouncementBanner from "@/components/announcements/AnnouncementBanner";
import shodelLogo from "@/assets/shodel-logo.png";

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { totalItems } = useCart();
  const { isAdmin, isModerator } = useAdmin();
  const { unreadMessages, pendingOrders, unreadNotifications, totalNotifications } = useNotificationCounts();
  const { isDeliveryPerson } = useDeliveryRole();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <>
      <AnnouncementBanner />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50 supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="h-14 md:h-16 flex items-center justify-between gap-3">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src={shodelLogo} alt="Jayee Express" className="h-9 md:h-10 w-auto" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { to: "/products", label: "Products" },
                { to: "/stores", label: "Stores" },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/download"
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all font-medium flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Get App
              </Link>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              <div className="w-56 lg:w-64">
                <GlobalSearch variant="navbar" />
              </div>
              
              <Link to="/cart" className="relative">
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                  <ShoppingCart className="h-[18px] w-[18px]" />
                  {totalItems > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4.5 w-4.5 flex items-center justify-center p-0 text-[10px] rounded-full">
                      {totalItems}
                    </Badge>
                  )}
                </Button>
              </Link>
              
              {user ? (
                <>
                  {isDeliveryPerson && (
                    <Link to="/delivery">
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9 border-primary/30 text-primary text-xs">
                        <Truck className="h-3.5 w-3.5" />
                        Deliveries
                      </Button>
                    </Link>
                  )}
                  {isModerator && (
                    <Link to="/admin">
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9 border-primary/30 text-primary text-xs">
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  {profile?.current_mode === "seller" && (
                    <Link to="/seller" className="relative">
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-9 text-xs">
                        <Store className="h-3.5 w-3.5" />
                        My Store
                      </Button>
                      {pendingOrders > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-destructive rounded-full">
                          {pendingOrders}
                        </Badge>
                      )}
                    </Link>
                  )}
                  <Link to="/notifications" className="relative">
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                      <Bell className="h-[18px] w-[18px]" />
                    </Button>
                    {unreadNotifications > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-destructive rounded-full">
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </Badge>
                    )}
                  </Link>
                  <Link to="/messages" className="relative">
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                      <MessageCircle className="h-[18px] w-[18px]" />
                    </Button>
                    {unreadMessages > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-destructive rounded-full">
                        {unreadMessages}
                      </Badge>
                    )}
                  </Link>
                  <Link to="/profile">
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                      <User className="h-[18px] w-[18px]" />
                    </Button>
                  </Link>
                  <ThemeToggle />
                  <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={handleSignOut}>
                    <LogOut className="h-[18px] w-[18px]" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl h-9 text-xs">
                      <LogIn className="h-3.5 w-3.5" />
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="hero" size="sm" className="gap-1.5 rounded-xl h-9 text-xs">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Get Started
                    </Button>
                  </Link>
                  <ThemeToggle />
                </>
              )}
            </div>

            {/* Mobile Search + Theme Toggle */}
            <div className="md:hidden flex-1 mx-2">
              <GlobalSearch variant="navbar" />
            </div>
            <div className="md:hidden flex-shrink-0">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
