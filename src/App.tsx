import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AuthProvider } from "@/hooks/useAuth";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Preferences from "./pages/Preferences";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import PublicProfile from "./pages/PublicProfile";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSources from "./pages/AdminSources";
import AdminArticles from "./pages/admin/AdminArticles";
import AdminManualIngest from "./pages/admin/AdminManualIngest";
import AdminUsers from "./pages/AdminUsers";
import YouTubeAdmin from "./pages/admin/YouTubeAdmin";
import YouTubeComments from "./pages/admin/YouTubeComments";
import YouTubeShorts from "./pages/admin/YouTubeShorts";
import ProtectedRoute from "./components/ProtectedRoute";
import Unsubscribe from "./pages/Unsubscribe";
import { TopicsIndexPage } from "./pages/topics/TopicsIndexPage";
import { TopicLandingPage } from "./pages/topics/TopicLandingPage";
import { TopicArchiveIndexPage } from "./pages/topics/TopicArchiveIndexPage";
import { TopicDailyArchivePage } from "./pages/topics/TopicDailyArchivePage";
import { SitemapPage } from "./pages/SitemapPage";
import Personalization from "./pages/Personalization";
import Partners from "./pages/admin/Partners";
import PartnerForm from "./pages/admin/PartnerForm";
import Partner from "./pages/Partner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PreferencesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnalyticsProvider>
              <Layout>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/feed" element={
                  <ProtectedRoute>
                    <Feed />
                  </ProtectedRoute>
                } />
                <Route path="/search" element={<Search />} />
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
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/personalization" element={<Personalization />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/onboarding" element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  } />
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
                  <Route path="/admin/manual-ingest" element={
                    <ProtectedRoute>
                      <AdminManualIngest />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/users" element={
                    <ProtectedRoute>
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/youtube" element={
                    <ProtectedRoute>
                      <YouTubeAdmin />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/youtube/comments" element={
                    <ProtectedRoute>
                      <YouTubeComments />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/youtube/shorts" element={
                    <ProtectedRoute>
                      <YouTubeShorts />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/partners" element={
                    <ProtectedRoute>
                      <Partners />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/partners/new" element={
                    <ProtectedRoute>
                      <PartnerForm />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/partners/:id" element={
                    <ProtectedRoute>
                      <PartnerForm />
                    </ProtectedRoute>
                  } />
                  <Route path="/topics" element={<TopicsIndexPage />} />
                  <Route path="/topics/:slug" element={<TopicLandingPage />} />
                  <Route path="/topics/:slug/archive" element={<TopicArchiveIndexPage />} />
                  <Route path="/topics/:slug/:date" element={<TopicDailyArchivePage />} />
                  <Route path="/admin/sitemap" element={<SitemapPage />} />
                  <Route path="/u/:username" element={<PublicProfile />} />
                  <Route path="/:slug" element={<Partner />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </AnalyticsProvider>
          </BrowserRouter>
        </PreferencesProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

