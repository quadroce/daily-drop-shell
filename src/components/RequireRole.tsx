import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RequireRoleProps {
  children: React.ReactNode;
  minRole: "user" | "editor" | "admin" | "superadmin";
}

const ROLE_HIERARCHY = {
  user: 0,
  editor: 1,
  admin: 2,
  superadmin: 3
};

const RequireRole = ({ children, minRole }: RequireRoleProps) => {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setUserRole(null);
        } else {
          setUserRole(data?.role || 'user');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole(null);
      }
      
      setRoleLoading(false);
    };

    if (!loading) {
      fetchUserRole();
    }
  }, [user, loading]);

  useEffect(() => {
    if (userRole) {
      const userRoleLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0;
      const requiredRoleLevel = ROLE_HIERARCHY[minRole];
      setHasAccess(userRoleLevel >= requiredRoleLevel);
    } else {
      setHasAccess(false);
    }
  }, [userRole, minRole]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Accesso Negato</h2>
          <p className="text-muted-foreground">Devi essere autenticato per accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Accesso Negato</h2>
          <p className="text-muted-foreground">
            Non hai i permessi necessari per accedere a questa pagina. 
            Richiesto: <strong>{minRole}</strong>, Il tuo ruolo: <strong>{userRole}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireRole;