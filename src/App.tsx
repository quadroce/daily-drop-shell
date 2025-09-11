import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Preferences from "./pages/Preferences";
import Profile from "./pages/Profile";
import Newsletter from "./pages/Newsletter";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Premium from "./pages/Premium";
import Corporate from "./pages/Corporate";
import Sponsor from "./pages/Sponsor";
import NotFound from "./pages/NotFound";
import PublicProfile from "./pages/PublicProfile";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSources from "./pages/AdminSources";
import AdminArticles from "./pages/admin/AdminArticles";
import ProtectedRoute from "./components/ProtectedRoute";
import { TopicLandingPage } from "./pages/topics/TopicLandingPage";
import { TopicArchiveIndexPage } from "./pages/topics/TopicArchiveIndexPage";
import { TopicDailyArchivePage } from "./pages/topics/TopicDailyArchivePage";
import { SitemapPage } from "./pages/SitemapPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PreferencesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/preferences" element={
                  <ProtectedRoute>
                    <Preferences />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/newsletter" element={<Newsletter />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/premium" element={<Premium />} />
                <Route path="/corporate" element={<Corporate />} />
                <Route path="/sponsor" element={<Sponsor />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/dashboard" element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/sources" element={
                  <ProtectedRoute>
                    <AdminSources />
                  </ProtectedRoute>
                } />
                <Route path="/admin/articles" element={
                  <ProtectedRoute>
                    <AdminArticles />
                  </ProtectedRoute>  
                } />
                <Route path="/topics/:slug" element={<TopicLandingPage />} />
                <Route path="/topics/:slug/archive" element={<TopicArchiveIndexPage />} />
                <Route path="/topics/:slug/:date" element={<TopicDailyArchivePage />} />
                <Route path="/sitemap.xml" element={<SitemapPage />} />
                <Route path="/u/:username" element={<PublicProfile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </PreferencesProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
