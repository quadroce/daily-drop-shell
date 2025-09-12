import { FunctionsHttpError } from "@supabase/supabase-js";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import RequireRole from "@/components/RequireRole";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  RefreshCw, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface Drop {
  id: number;
  title: string;
  url: string;
  source_name?: string;
  tag_done?: boolean;
  created_at: string;
  tags?: string[];
  l1_topic_id?: number;
  l2_topic_id?: number;
  l1_label?: string;
  l2_label?: string;
}

interface Topic {
  id: number;
  label: string;
  level: number;
}

interface TaggingParams {
  [key: string]: any;
}

const AdminArticles = () => {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<{ id: number; name: string }[]>([]);
  const [taggingParams, setTaggingParams] = useState<TaggingParams>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("ALL_SOURCES");
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);

  const [editTagsModal, setEditTagsModal] = useState<{ open: boolean; drop?: Drop }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; drop?: Drop }>({ open: false });
  const [selectedL1, setSelectedL1] = useState<number | null>(null);
  const [selectedL2, setSelectedL2] = useState<number | null>(null);
  const [selectedL3, setSelectedL3] = useState<number[]>([]);

  const { toast } = useToast();
  const itemsPerPage = 100;

  const fetchDrops = useCallback(async () => {
    setLoading(true);
    console.log('Fetching drops...');
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Enhanced query with L1, L2 topic labels
      const { data: dropsData, error: dropsError } = await supabase
        .from('drops')
        .select(`
          id, title, url, tag_done, created_at, tags, l1_topic_id, l2_topic_id,
          sources!inner(name),
          l1_topic:topics!l1_topic_id(id, label),
          l2_topic:topics!l2_topic_id(id, label)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (dropsError) {
        console.error('Drops query error:', dropsError);
        throw dropsError;
      }

      console.log('Drops data loaded:', dropsData?.length || 0, 'items');

      // Get total count
      const { count, error: countError } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Count query error:', countError);
        throw countError;
      }

      // Transform data to match our Drop interface
      const transformedData = (dropsData || []).map((item: any) => ({
        ...item,
        source_name: item.sources?.name || 'N/A',
        l1_label: item.l1_topic?.label,
        l2_label: item.l2_topic?.label
      }));

      setDrops(transformedData);
      setTotalCount(count || 0);
      console.log('Data set successfully, total count:', count);
    } catch (error) {
      console.error('Error fetching drops:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli articoli",
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [currentPage, searchQuery, selectedSource, showUntaggedOnly, toast]);

  const fetchTopics = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('id, label, level')
        .order('level, label');

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sources')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  }, []);

  const fetchTaggingParams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tagging_params')
        .select('*');

      if (error) throw error;

      const params: TaggingParams = {};
      data?.forEach((param) => {
        params[param.param_name] = param.param_value;
      });

      setTaggingParams(params);
    } catch (error) {
      console.error('Error fetching tagging params:', error);
    }
  }, []);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  useEffect(() => {
    fetchTopics();
    fetchSources();
    fetchTaggingParams();
  }, [fetchTopics, fetchSources, fetchTaggingParams]);

  const handleRetag = async (dropId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Errore",
          description: "Devi essere autenticato per eseguire questa operazione",
          variant: "destructive",
        });
        return;
      }

      console.log(`Attempting to retag drop ${dropId}`);

      const { data, error } = await supabase.functions.invoke('admin-retag-drop', {
        body: { dropId },
        headers: { 
          Authorization: `Bearer ${session.access_token}` 
        }
      });

      if (error) {
        console.error('Retag error details:', error);
        throw error;
      }

      console.log('Retag success:', data);

      toast({
        title: "Successo",
        description: "Articolo ri-taggato con successo"
      });

      fetchDrops();
    } catch (error) {
      console.error('Error retagging drop:', error);
      const errorMsg = error instanceof FunctionsHttpError 
        ? `Errore HTTP: ${error.message}`
        : "Errore nel ri-tagging dell'articolo";
      
      toast({
        title: "Errore",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleEditTags = async () => {
    if (!editTagsModal.drop) return;

    try {
      // Validate constraints
      if (!selectedL1 || !selectedL2 || selectedL3.length === 0 || selectedL3.length > 3) {
        toast({
          title: "Errore di validazione",
          description: "Devi selezionare 1 topic L1, 1 topic L2 e 1-3 topic L3",
          variant: "destructive",
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const dropId = Number(editTagsModal.drop.id);
      const topicIds = [selectedL1, selectedL2, ...selectedL3];

      const { error } = await supabase.functions.invoke('admin-update-tags', {
        body: { dropId, topicIds },
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });

      if (error) throw error;

      toast({
        title: "Successo", 
        description: "Tag aggiornati"
      });

      setEditTagsModal({ open: false });
      fetchDrops();
    } catch (error) {
      console.error('Error updating tags:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dei tag",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.drop) return;

    try {
      const { error } = await supabase.functions.invoke('admin-delete-drop', {
        body: { dropId: deleteModal.drop.id }
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Articolo eliminato con successo"
      });

      setDeleteModal({ open: false });
      fetchDrops();
    } catch (error) {
      console.error('Error deleting drop:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione dell'articolo",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTaggingParams = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-update-tagging-params', {
        body: { params: taggingParams }
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Parametri aggiornati con successo"
      });
    } catch (error) {
      console.error('Error updating tagging params:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dei parametri",
        variant: "destructive",
      });
    }
  };

  const openEditTagsModal = async (drop: Drop) => {
    try {
      // Set current L1, L2, L3 selections
      setSelectedL1(drop.l1_topic_id || null);
      setSelectedL2(drop.l2_topic_id || null);
      
      // Get L3 topics from tags
      const l3TopicIds: number[] = [];
      if (drop.tags) {
        for (const tag of drop.tags) {
          const { data: l3Topics } = await supabase
            .from('topics')
            .select('id')
            .eq('slug', tag)
            .eq('level', 3)
            .single();
          
          if (l3Topics) {
            l3TopicIds.push(l3Topics.id);
          }
        }
      }
      setSelectedL3(l3TopicIds);
      
    } catch (error) {
      console.error('Error in openEditTagsModal:', error);
      setSelectedL1(null);
      setSelectedL2(null);
      setSelectedL3([]);
    }
    
    setEditTagsModal({ open: true, drop });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <RequireRole minRole="editor">
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestione Articoli</h1>
          <Button onClick={fetchDrops} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Cerca</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Titolo, riassunto o URL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="source">Fonte</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutte le fonti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_SOURCES">Tutte le fonti</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.name}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="untagged"
                  checked={showUntaggedOnly}
                  onChange={(e) => setShowUntaggedOnly(e.target.checked)}
                />
                <Label htmlFor="untagged">Solo articoli non taggati</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Articoli ({totalCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drops.map((drop) => (
                    <TableRow key={drop.id}>
                      <TableCell className="max-w-xs">
                        <div className="space-y-1">
                          <div className="font-medium line-clamp-2">{drop.title}</div>
                          <a 
                            href={drop.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            Apri <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>{drop.source_name || 'N/A'}</TableCell>
                       <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {drop.l1_label && (
                            <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                              L1: {drop.l1_label}
                            </Badge>
                          )}
                          {drop.l2_label && (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              L2: {drop.l2_label}
                            </Badge>
                          )}
                          {drop.tags && drop.tags.length > 0 ? (
                            drop.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                L3: {tag}
                              </Badge>
                            ))
                          ) : null}
                          {(!drop.l1_label && !drop.l2_label && (!drop.tags || drop.tags.length === 0)) && (
                            <span className="text-gray-400 text-sm">Nessun tag</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={drop.tag_done ? "default" : "secondary"}>
                          {drop.tag_done ? "Taggato" : "Da taggare"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {format(new Date(drop.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditTagsModal(drop)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetag(drop.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteModal({ open: true, drop })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600">
                Pagina {currentPage} di {totalPages} ({totalCount} risultati)
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parametri di Tagging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(taggingParams).map(([key, value]) => (
                <div key={key}>
                  <Label htmlFor={key}>{key.replace(/_/g, ' ').toUpperCase()}</Label>
                  <Input
                    id={key}
                    value={String(value)}
                    onChange={(e) => setTaggingParams(prev => ({
                      ...prev,
                      [key]: e.target.value
                    }))}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleUpdateTaggingParams}>
              Salva Parametri
            </Button>
          </CardContent>
        </Card>

        <Dialog open={editTagsModal.open} onOpenChange={(open) => setEditTagsModal({ open })}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Modifica Tag - {editTagsModal.drop?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Livello 1 (obbligatorio)</Label>
                <Select 
                  value={selectedL1?.toString() || ""} 
                  onValueChange={(value) => setSelectedL1(value ? Number(value) : null)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Seleziona topic L1" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics
                      .filter(topic => topic.level === 1)
                      .map(topic => (
                        <SelectItem key={topic.id} value={topic.id.toString()}>
                          {topic.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Livello 2 (obbligatorio)</Label>
                <Select 
                  value={selectedL2?.toString() || ""} 
                  onValueChange={(value) => setSelectedL2(value ? Number(value) : null)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Seleziona topic L2" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics
                      .filter(topic => topic.level === 2)
                      .map(topic => (
                        <SelectItem key={topic.id} value={topic.id.toString()}>
                          {topic.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Livello 3 (1-3 topic)</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {topics
                      .filter(topic => topic.level === 3)
                      .map(topic => (
                        <label key={topic.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedL3.includes(topic.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedL3.length < 3) {
                                  setSelectedL3(prev => [...prev, topic.id]);
                                } else {
                                  toast({
                                    title: "Limite raggiunto",
                                    description: "Massimo 3 topic L3 consentiti",
                                    variant: "destructive",
                                  });
                                }
                              } else {
                                setSelectedL3(prev => prev.filter(id => id !== topic.id));
                              }
                            }}
                            disabled={!selectedL3.includes(topic.id) && selectedL3.length >= 3}
                          />
                          <span className={selectedL3.includes(topic.id) ? "font-medium" : ""}>
                            {topic.label}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Selezionati: {selectedL3.length}/3
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-md">
                <Label className="text-sm font-medium">Validazione</Label>
                <div className="text-xs text-gray-600 mt-1">
                  {selectedL1 ? "✓ L1 selezionato" : "✗ L1 richiesto"}<br/>
                  {selectedL2 ? "✓ L2 selezionato" : "✗ L2 richiesto"}<br/>
                  {selectedL3.length > 0 ? `✓ ${selectedL3.length} L3 selezionati` : "✗ Almeno 1 L3 richiesto"}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditTagsModal({ open: false })}>
                  Annulla
                </Button>
                <Button 
                  onClick={handleEditTags}
                  disabled={!selectedL1 || !selectedL2 || selectedL3.length === 0 || selectedL3.length > 3}
                >
                  Salva Tag
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare l'articolo "{deleteModal.drop?.title}"?
                Questa azione aggiungerà il tag "deleted" all'articolo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RequireRole>
  );
};

export default AdminArticles;