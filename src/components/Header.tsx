import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronDown, Droplets } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { user, loading } = useAuth();

  // Fetch user role when user changes
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          setUserRole(profileData?.role || null);
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You've been logged out of your account.",
      });
      navigate("/");
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error signing out",
        description: "There was a problem signing you out.",
        variant: "destructive",
      });
    }
  };

  const getUserInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const isActive = (path: string) => location.pathname === path;

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const navLinks = [
    { label: "Feed", path: "/feed" },
    { label: "Topics", path: "/topics/ai-ml" },
    { label: "Pricing", path: "/pricing" },
    { label: "Newsletter", path: "/newsletter" },
    ...(isAdmin ? [{ label: "Admin", path: "/admin" }] : [])
  ];

  const NavLinks = ({ mobile = false, onLinkClick }: { mobile?: boolean; onLinkClick?: () => void }) => (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          onClick={onLinkClick}
          className={`transition-colors hover:text-primary ${
            isActive(link.path) 
              ? "text-primary font-medium" 
              : "text-muted-foreground"
          } ${mobile ? "block py-2" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <Droplets className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">DailyDrops</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <NavLinks />
        </nav>

        {/* User Menu */}
        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="hidden md:flex items-center space-x-2">
              <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ) : user ? (
            /* Desktop User Menu */
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getUserInitials(user.email || '')}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/preferences" className="cursor-pointer">
                      Preferences
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive" onClick={handleLogout}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Button asChild variant="ghost">
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-card">
              <div className="flex flex-col space-y-6 mt-6">
                {user ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getUserInitials(user.email || '')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                      </div>
                    </div>
                    
                    <nav className="flex flex-col space-y-4">
                      <NavLinks mobile onLinkClick={() => setIsSheetOpen(false)} />
                      
                      <div className="border-t pt-4 space-y-2">
                        <Link to="/profile" onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">
                          Profile
                        </Link>
                        <Link to="/preferences" onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">
                          Preferences
                        </Link>
                        <Link to="/settings" onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">
                          Settings
                        </Link>
                        <button 
                          className="block py-2 text-destructive text-left w-full"
                          onClick={() => {
                            setIsSheetOpen(false);
                            handleLogout();
                          }}
                        >
                          Logout
                        </button>
                      </div>
                    </nav>
                  </>
                ) : (
                  <>
                    <nav className="flex flex-col space-y-4">
                      <NavLinks mobile onLinkClick={() => setIsSheetOpen(false)} />
                      
                      <div className="border-t pt-4">
                        <Link 
                          to="/auth" 
                          onClick={() => setIsSheetOpen(false)} 
                          className="block py-2 text-primary hover:text-primary/80"
                        >
                          Sign In
                        </Link>
                      </div>
                    </nav>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;