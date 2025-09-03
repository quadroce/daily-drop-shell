import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Globe, Rss, CheckCircle, XCircle, AlertTriangle, Trash2, ArrowLeft, BarChart3 } from "lucide-react";

interface Source {
  id: number;
  name: string;
  homepage_url: string;
  feed_url: string | null;
  status: string;
  official: boolean;
  type: string;
  created_at: string;
  // Statistiche calcolate
  total_articles?: number;
  failed_articles?: number;
  success_rate?: number;
}

interface NewSource {
  name: string;
  homepage_url: string;
  feed_url: string;
  official: boolean;
}

const AdminSources = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [newSource, setNewSource] = useState<NewSource>({
    name: '',
    homepage_url: '',
    feed_url: '',
    official: false
  });

  useEffect(() => {
    checkAccess();
  }, [authLoading]);

  const checkAccess = async () => {
    if (authLoading) return;

    // Check if user has session
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      navigate("/auth");
      return;
    }

    // Fetch user profile and role
    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("id", currentSession.user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        setLoading(false);
        return;
      }

      // Check if user is admin or superadmin
      const isAdmin = profileData?.role === 'admin' || profileData?.role === 'superadmin';
      setIsAuthorized(isAdmin);
      
      if (isAdmin) {
        await fetchSources();
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Access check error:", error);
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const { data: sourcesData, error } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calcola le statistiche per ogni sorgente
      const sourcesWithStats = await Promise.all(
        (sourcesData || []).map(async (source) => {
          try {
            // Conta gli articoli totali da drops
            const { count: totalArticles } = await supabase
              .from('drops')
              .select('*', { count: 'exact', head: true })
              .eq('source_id', source.id);

            // Conta gli articoli falliti dalla coda
            const { count: failedArticles } = await supabase
              .from('ingestion_queue')
              .select('*', { count: 'exact', head: true })
              .eq('source_id', source.id)
              .eq('status', 'failed');

            const total = totalArticles || 0;
            const failed = failedArticles || 0;
            const successRate = total > 0 ? ((total - failed) / total) * 100 : 0;

            return {
              ...source,
              total_articles: total,
              failed_articles: failed,
              success_rate: successRate
            };
          } catch (statError) {
            console.error(`Error fetching stats for source ${source.id}:`, statError);
            return {
              ...source,
              total_articles: 0,
              failed_articles: 0,
              success_rate: 0
            };
          }
        })
      );

      setSources(sourcesWithStats);
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le sorgenti",
        variant: "destructive",
      });
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.homepage_url) {
      toast({
        title: "Campi mancanti",
        description: "Nome e URL homepage sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setActionLoading('add');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token');
      }

      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/admin-api/sources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newSource.name,
          homepage_url: newSource.homepage_url,
          feed_url: newSource.feed_url || null,
          official: newSource.official
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create source');
      }

      toast({
        title: "Sorgente aggiunta",
        description: `${newSource.name} è stata aggiunta con successo`,
      });

      // Reset form and close dialog
      setNewSource({ name: '', homepage_url: '', feed_url: '', official: false });
      setIsAddDialogOpen(false);
      
      // Refresh sources list
      await fetchSources();
    } catch (error) {
      console.error('Error adding source:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : 'Impossibile aggiungere la sorgente',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    setActionLoading(`delete-${sourceId}`);
    try {
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', sourceId);

      if (error) throw error;

      toast({
        title: "Sorgente eliminata",
        description: "La sorgente è stata rimossa con successo",
      });

      // Refresh sources list
      await fetchSources();
    } catch (error) {
      console.error('Error deleting source:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la sorgente",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Attiva</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Inattiva</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Errore</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Solo Amministratori</CardTitle>
            <CardDescription>
              Non hai i permessi per accedere a questa area.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/feed")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna al Feed
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gestione Sorgenti</h1>
            <p className="text-muted-foreground mt-2">
              Amministra le sorgenti di contenuto della piattaforma
            </p>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Sorgente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuova Sorgente</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli della nuova sorgente di contenuto
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="es. TechCrunch"
                  value={newSource.name}
                  onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="homepage_url">URL Homepage *</Label>
                <Input
                  id="homepage_url"
                  placeholder="https://techcrunch.com"
                  value={newSource.homepage_url}
                  onChange={(e) => setNewSource(prev => ({ ...prev, homepage_url: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="feed_url">URL Feed RSS</Label>
                <Input
                  id="feed_url"
                  placeholder="https://techcrunch.com/feed/"
                  value={newSource.feed_url}
                  onChange={(e) => setNewSource(prev => ({ ...prev, feed_url: e.target.value }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="official"
                  checked={newSource.official}
                  onCheckedChange={(checked) => setNewSource(prev => ({ ...prev, official: checked }))}
                />
                <Label htmlFor="official">Sorgente Ufficiale</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleAddSource} disabled={actionLoading === 'add'}>
                {actionLoading === 'add' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Aggiungi Sorgente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiche generali */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sorgenti Totali</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sources.length}</div>
            <p className="text-xs text-muted-foreground">
              {sources.filter(s => s.status === 'active').length} attive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Feed RSS</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.filter(s => s.feed_url).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((sources.filter(s => s.feed_url).length / sources.length) * 100) || 0}% del totale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articoli Totali</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.reduce((acc, s) => acc + (s.total_articles || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Da tutte le sorgenti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articoli Falliti</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {sources.reduce((acc, s) => acc + (s.failed_articles || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Necessitano attenzione
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella sorgenti */}
      <Card>
        <CardHeader>
          <CardTitle>Elenco Sorgenti</CardTitle>
          <CardDescription>
            {sources.length} sorgent{sources.length !== 1 ? 'i' : 'e'} configurate - Non ci sono limiti al numero di sorgenti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Articoli</TableHead>
                  <TableHead className="text-right">Falliti</TableHead>
                  <TableHead className="text-right">Successo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {source.name}
                          {source.official && (
                            <Badge variant="secondary" className="text-xs">
                              Ufficiale
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <a 
                            href={source.homepage_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {source.homepage_url}
                          </a>
                        </div>
                        {source.feed_url && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Rss className="h-3 w-3" />
                            RSS disponibile
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {source.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(source.status)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {source.total_articles || 0}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {source.failed_articles || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${getSuccessRateColor(source.success_rate || 0)}`}>
                        {(source.success_rate || 0).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={actionLoading === `delete-${source.id}`}
                          >
                            {actionLoading === `delete-${source.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina Sorgente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{source.name}"? 
                              Questa azione non può essere annullata e rimuoverà tutti gli articoli associati.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteSource(source.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {sources.length === 0 && (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nessuna sorgente</h3>
                <p className="text-muted-foreground mb-4">
                  Inizia aggiungendo la prima sorgente di contenuto
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Prima Sorgente
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSources;