import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Store, ShoppingCart, Menu, Bell, MessageCircle, User, LogOut, Shield, Truck, Download, LogIn, History } from "lucide-react";
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

  if (!isMobile) return null;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const tabClass = (path: string) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
      isActive(path) ? "text-primary" : "text-muted-foreground"
    }`;

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

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border h-16 flex items-center safe-area-bottom">
      <Link to="/" className={tabClass("/")}>
        <Home className="h-5 w-5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>

      <Link to="/products" className={tabClass("/products")}>
        <ShoppingBag className="h-5 w-5" />
        <span className="text-[10px] font-medium">Products</span>
      </Link>

      <Link to="/stores" className={tabClass("/stores")}>
        <Store className="h-5 w-5" />
        <span className="text-[10px] font-medium">Stores</span>
      </Link>

      <Link to="/cart" className={`${tabClass("/cart")} relative`}>
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-3 h-4 w-4 flex items-center justify-center p-0 text-[9px]">
              {totalItems}
            </Badge>
          )}
        </div>
        <span className="text-[10px] font-medium">Cart</span>
      </Link>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-muted-foreground relative`}>
            <div className="relative">
              <Menu className="h-5 w-5" />
              {user && totalNotifications > 0 && (
                <Badge className="absolute -top-2 -right-3 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-destructive">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="pb-safe">
          <div className="px-4 py-3 max-h-[70vh] overflow-y-auto">
            <div className="mb-3">
              <GlobalSearch variant="navbar" />
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/download")}>
                <Download className="h-4 w-4" />
                Get App
              </Button>

              {user ? (
                <>
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/notifications")}>
                    <Bell className="h-4 w-4" />
                    Notifications
                    {unreadNotifications > 0 && (
                      <Badge className="ml-auto bg-destructive">{unreadNotifications > 9 ? "9+" : unreadNotifications}</Badge>
                    )}
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/messages")}>
                    <MessageCircle className="h-4 w-4" />
                    Messages
                    {unreadMessages > 0 && (
                      <Badge className="ml-auto bg-destructive">{unreadMessages}</Badge>
                    )}
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/profile")}>
                    <User className="h-4 w-4" />
                    Profile
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/purchases")}>
                    <History className="h-4 w-4" />
                    Purchase History
                  </Button>
                  {isDeliveryPerson && (
                    <Button variant="outline" className="w-full justify-start gap-3 border-primary text-primary" onClick={() => closeAndNavigate("/delivery")}>
                      <Truck className="h-4 w-4" />
                      My Deliveries
                    </Button>
                  )}
                  {profile?.current_mode === "seller" && (
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/seller")}>
                      <Store className="h-4 w-4" />
                      My Store
                      {pendingOrders > 0 && (
                        <Badge className="ml-auto bg-destructive">{pendingOrders}</Badge>
                      )}
                    </Button>
                  )}
                  {isModerator && (
                    <Button variant="outline" className="w-full justify-start gap-3 border-primary text-primary" onClick={() => closeAndNavigate("/admin")}>
                      <Shield className="h-4 w-4" />
                      Admin Dashboard
                    </Button>
                  )}
                  <hr className="my-1 border-border" />
                  <Button variant="ghost" className="w-full justify-start gap-3 text-destructive" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/auth")}>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/auth")}>
                    <Store className="h-4 w-4" />
                    Open Store
                  </Button>
                  <Button variant="hero" className="w-full justify-start gap-3" onClick={() => closeAndNavigate("/auth")}>
                    <ShoppingBag className="h-4 w-4" />
                    Start Shopping
                  </Button>
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default MobileTabBar;
