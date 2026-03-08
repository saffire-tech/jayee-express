import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { PWABadgeManager } from "@/components/PWABadgeManager";
import SplashScreen from "@/components/SplashScreen";
import { Loader2 } from "lucide-react";

// Eagerly loaded (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy-loaded routes
const Profile = lazy(() => import("./pages/Profile"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Products = lazy(() => import("./pages/Products"));
const StorePage = lazy(() => import("./pages/StorePage"));
const Stores = lazy(() => import("./pages/Stores"));
const Cart = lazy(() => import("./pages/Cart"));
const Messages = lazy(() => import("./pages/Messages"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const StoresManagement = lazy(() => import("./pages/admin/StoresManagement"));
const ProductsManagement = lazy(() => import("./pages/admin/ProductsManagement"));
const OrdersManagement = lazy(() => import("./pages/admin/OrdersManagement"));
const ReportsManagement = lazy(() => import("./pages/admin/ReportsManagement"));
const ReportIssue = lazy(() => import("./pages/ReportIssue"));
const Download = lazy(() => import("./pages/Download"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const PurchaseHistory = lazy(() => import("./pages/PurchaseHistory"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const DeliveryDashboard = lazy(() => import("./pages/DeliveryDashboard"));
const MobileTabBar = lazy(() => import("./components/layout/MobileTabBar"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem("uniplug_visited");
    if (hasVisited) {
      setIsFirstVisit(false);
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem("uniplug_visited", "true");
    setShowSplash(false);
  };

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showSplash && isFirstVisit && (
            <SplashScreen onComplete={handleSplashComplete} />
          )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <PWABadgeManager />
              <AdminProvider>
                <CartProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/purchases" element={<PurchaseHistory />} />
                      <Route path="/seller" element={<SellerDashboard />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/product/:id" element={<ProductDetail />} />
                      <Route path="/stores" element={<Stores />} />
                      <Route path="/store/:id" element={<StorePage />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/notifications" element={<NotificationCenter />} />
                      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                      <Route path="/admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
                      <Route path="/admin/stores" element={<AdminRoute><StoresManagement /></AdminRoute>} />
                      <Route path="/admin/products" element={<AdminRoute><ProductsManagement /></AdminRoute>} />
                      <Route path="/admin/orders" element={<AdminRoute><OrdersManagement /></AdminRoute>} />
                      <Route path="/admin/reports" element={<AdminRoute><ReportsManagement /></AdminRoute>} />
                      <Route path="/delivery" element={<DeliveryDashboard />} />
                      <Route path="/report-issue" element={<ReportIssue />} />
                      <Route path="/download" element={<Download />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <MobileTabBar />
                  </Suspense>
                </CartProvider>
              </AdminProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
