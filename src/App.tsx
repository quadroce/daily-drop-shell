import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/corporate" element={<Corporate />} />
            <Route path="/sponsor" element={<Sponsor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
