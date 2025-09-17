import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { AlphaRibbon } from "./AlphaRibbon";
import { FeedbackFab } from "./FeedbackFab";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <AlphaRibbon />
      <FeedbackFab />
    </div>
  );
};

export default Layout;