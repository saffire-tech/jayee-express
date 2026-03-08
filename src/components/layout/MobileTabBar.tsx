import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Store, ShoppingCart, Menu, Bell, MessageCircle, User, LogOut, Shield, Truck, Download, LogIn, History, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useDeliveryRole } from "@/hooks/useDeliveryRole";
import { useIsMobile } from "@/hooks/use-mobile";
import GlobalSearch from "@/components/search/GlobalSearch";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { motion } from "framer-motion";

const MobileTabBar = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { totalItems } = useCart();
  const { isAdmin, isModerator } = useAdmin();
  const { unreadMessages, pendingOrders, unreadNotifications, totalNotifications } = useNotificationCounts();
  const { isDeliveryPerson } = useDeliveryRole();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!isMobile) return null;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    setDrawerOpen(false);
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const closeAndNavigate = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const tabs = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/products", icon: ShoppingBag, label: "Products" },
    { path: "/stores", icon: Store, label: "Stores" },
    { path: "/cart", icon: ShoppingCart, label: "Cart", badge: totalItems },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex items-center h-14">
        {tabs.map(tab => (
          <Link key={tab.path} to={tab.path} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 relative">
            <div className="relative">
              {isActive(tab.path) && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -inset-1.5 rounded-xl bg-primary/10"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <tab.icon className={`h-5 w-5 relative z-10 transition-colors ${isActive(tab.path) ? "text-primary" : "text-muted-foreground"}`} />
              {tab.badge && tab.badge > 0 && (
                <Badge className="absolute -top-2 -right-3 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] rounded-full">
                  {tab.badge}
                </Badge>
              )}
            </div>
            <span className={`text-[10px] font-medium transition-colors ${isActive(tab.path) ? "text-primary" : "text-muted-foreground"}`}>
              {tab.label}
            </span>
          </Link>
        ))}

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <button className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 relative">
              <div className="relative">
                <Menu className="h-5 w-5 text-muted-foreground" />
                {user && totalNotifications > 0 && (
                  <Badge className="absolute -top-2 -right-3 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] bg-destructive rounded-full">
                    {totalNotifications > 9 ? "9+" : totalNotifications}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">More</span>
            </button>
          </DrawerTrigger>
          <DrawerContent className="pb-safe">
            <div className="px-4 pt-2 pb-4 max-h-[70vh] overflow-y-auto">
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
              <div className="mb-3">
                <GlobalSearch variant="navbar" />
              </div>
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/download")}>
                  <Download className="h-4 w-4 text-muted-foreground" />
                  Get App
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </Button>

                {user ? (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/notifications")}>
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      Notifications
                      {unreadNotifications > 0 && (
                        <Badge className="ml-auto bg-destructive text-[10px] px-1.5">{unreadNotifications > 9 ? "9+" : unreadNotifications}</Badge>
                      )}
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/messages")}>
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      Messages
                      {unreadMessages > 0 && (
                        <Badge className="ml-auto bg-destructive text-[10px] px-1.5">{unreadMessages}</Badge>
                      )}
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/profile")}>
                      <User className="h-4 w-4 text-muted-foreground" />
                      Profile
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/purchases")}>
                      <History className="h-4 w-4 text-muted-foreground" />
                      Purchase History
                    </Button>
                    {isDeliveryPerson && (
                      <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11 text-primary" onClick={() => closeAndNavigate("/delivery")}>
                        <Truck className="h-4 w-4" />
                        My Deliveries
                      </Button>
                    )}
                    {profile?.current_mode === "seller" && (
                      <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/seller")}>
                        <Store className="h-4 w-4 text-muted-foreground" />
                        My Store
                        {pendingOrders > 0 && (
                          <Badge className="ml-auto bg-destructive text-[10px] px-1.5">{pendingOrders}</Badge>
                        )}
                      </Button>
                    )}
                    {isModerator && (
                      <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11 text-primary" onClick={() => closeAndNavigate("/admin")}>
                        <Shield className="h-4 w-4" />
                        Admin Dashboard
                      </Button>
                    )}
                    <div className="h-px bg-border my-1" />
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11 text-destructive hover:text-destructive" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl h-11" onClick={() => closeAndNavigate("/auth")}>
                      <LogIn className="h-4 w-4 text-muted-foreground" />
                      Sign In
                    </Button>
                    <Button variant="hero" className="w-full justify-center gap-2 rounded-xl h-11 mt-1" onClick={() => closeAndNavigate("/auth")}>
                      <ShoppingBag className="h-4 w-4" />
                      Get Started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
};

export default MobileTabBar;
