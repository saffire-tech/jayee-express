import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, ShoppingBag, ShoppingCart, Store, User, LogOut, Shield, MessageCircle, Download, LogIn, Bell, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useDeliveryRole } from "@/hooks/useDeliveryRole";
import GlobalSearch from "@/components/search/GlobalSearch";
import uniplugLogo from "@/assets/uniplug-logo.png";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    user,
    profile,
    signOut
  } = useAuth();
  const {
    totalItems
  } = useCart();
  const {
    isAdmin,
    isModerator
  } = useAdmin();
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

  return <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="h-16 md:h-20 flex-row gap-[10px] flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={uniplugLogo} alt="Uniplug" className="h-10 md:h-12 w-auto" />
          </Link>

          {/* Desktop Navigation - Scrollable */}
          <div className="hidden md:flex items-center gap-[10px] overflow-x-auto scrollbar-hide">
            <Link to="/products" className="text-muted-foreground hover:text-foreground transition-colors font-medium whitespace-nowrap">
              Products
            </Link>
            <Link to="/stores" className="text-muted-foreground hover:text-foreground transition-colors font-medium whitespace-nowrap">
              Stores
            </Link>
            
            
            <Link to="/download" className="text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1 whitespace-nowrap">
              <Download className="h-4 w-4 flex-shrink-0" />
              Get App
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <div className="w-64">
              <GlobalSearch variant="navbar" />
            </div>
            
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {totalItems}
                  </Badge>}
              </Button>
            </Link>
            
            {user ? <>
                {isDeliveryPerson && (
                  <Link to="/delivery">
                    <Button variant="outline" className="gap-2 border-primary text-primary">
                      <Truck className="h-4 w-4" />
                      Deliveries
                    </Button>
                  </Link>
                )}
                {isModerator && <Link to="/admin">
                    <Button variant="outline" className="gap-2 border-primary text-primary">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>}
                {profile?.current_mode === "seller" && (
                  <Link to="/seller" className="relative">
                    <Button variant="outline" className="gap-2">
                      <Store className="h-4 w-4" />
                      My Store
                    </Button>
                    {pendingOrders > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                        {pendingOrders}
                      </Badge>
                    )}
                  </Link>
                )}
                <Link to="/notifications" className="relative">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                  </Button>
                  {unreadNotifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </Badge>
                  )}
                </Link>
                <Link to="/messages" className="relative">
                  <Button variant="ghost" size="icon">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  {unreadMessages > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                      {unreadMessages}
                    </Badge>
                  )}
                </Link>
                <Link to="/profile">
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </> : <>
                <Link to="/auth">
                  <Button variant="outline" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" className="gap-2">
                    <Store className="h-4 w-4" />
                    Open Store
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="hero" className="gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Start Shopping
                  </Button>
                </Link>
              </>}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-foreground flex-shrink-0 relative" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            {!isMenuOpen && user && totalNotifications > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                {totalNotifications > 9 ? "9+" : totalNotifications}
              </Badge>
            )}
          </button>
        </div>

        {/* Mobile Menu - Scrollable */}
        {isMenuOpen && (
          <div className="md:hidden max-h-[calc(100vh-64px)] overflow-y-auto py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-3">
              {/* Mobile Search */}
              <div className="px-1">
                <GlobalSearch variant="navbar" />
              </div>
              
              <hr className="border-border" />
              
              <Link to="/products" className="text-foreground font-medium py-2 px-1" onClick={() => setIsMenuOpen(false)}>
                Browse Products
              </Link>
              <Link to="/stores" className="text-foreground font-medium py-2 px-1" onClick={() => setIsMenuOpen(false)}>
                Browse Stores
              </Link>
              
              <Link to="/download" className="text-foreground font-medium py-2 px-1 flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
                <Download className="h-4 w-4" />
                Get App
              </Link>
              
              <hr className="border-border" />
              
              <Link to="/cart" onClick={() => setIsMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Cart
                  {totalItems > 0 && <Badge className="ml-2">{totalItems}</Badge>}
                </Button>
              </Link>
              
              <hr className="border-border" />
              
              {user ? (
                <>
                  {isDeliveryPerson && (
                    <Link to="/delivery" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start gap-2 border-primary text-primary">
                        <Truck className="h-4 w-4" />
                        My Deliveries
                      </Button>
                    </Link>
                  )}
                  {isModerator && (
                    <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start gap-2 border-primary text-primary">
                        <Shield className="h-4 w-4" />
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                  {profile?.current_mode === "seller" && (
                    <Link to="/seller" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Store className="h-4 w-4" />
                        My Store
                        {pendingOrders > 0 && (
                          <Badge className="ml-auto bg-destructive">{pendingOrders}</Badge>
                        )}
                      </Button>
                    </Link>
                  )}
                  <Link to="/notifications" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Bell className="h-4 w-4" />
                      Notifications
                      {unreadNotifications > 0 && (
                        <Badge className="ml-auto bg-destructive">{unreadNotifications > 9 ? "9+" : unreadNotifications}</Badge>
                      )}
                    </Button>
                  </Link>
                  <Link to="/messages" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Messages
                      {unreadMessages > 0 && (
                        <Badge className="ml-auto bg-destructive">{unreadMessages}</Badge>
                      )}
                    </Button>
                  </Link>
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2" 
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Store className="h-4 w-4" />
                      Open Store
                    </Button>
                  </Link>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="hero" className="w-full justify-start gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Start Shopping
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>;
};

export default Navbar;
