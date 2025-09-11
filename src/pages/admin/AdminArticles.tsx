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
  topic_labels?: string[];
  l1_slug?: string;
  l2_slug?: string;
  l3_slugs?: string[];
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
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);

  const { toast } = useToast();
  const itemsPerPage = 100;

  const fetchDrops = useCallback(async () => {
    setLoading(true);
    console.log('Fetching drops...');
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Simple query first - let's get basic drops data
      const { data: dropsData, error: dropsError } = await supabase
        .from('drops')
        .select(`
          id, title, url, tag_done, created_at, tags,
          sources!inner(name)
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
        source_name: item.sources?.name || 'N/A'
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
      const { error } = await supabase.functions.invoke('admin-retag-drop', {
        body: { dropId }
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Articolo ri-taggato con successo"
      });

      fetchDrops();
    } catch (error) {
      console.error('Error retagging drop:', error);
      toast({
        title: "Errore",
        description: "Errore nel ri-tagging dell'articolo",
        variant: "destructive",
      });
    }
  };

  const handleEditTags = async () => {
    if (!editTagsModal.drop) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const dropId = Number(editTagsModal.drop.id);
      const topicIds = selectedTopics.map((v) => Number(v));

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
      const { data: contentTopics, error } = await supabase
        .from('content_topics')
        .select('topic_id')
        .eq('content_id', drop.id);

      if (error) {
        console.error('Error loading existing topics:', error);
        setSelectedTopics([]);
      } else {
        const existingTopicIds = (contentTopics || []).map(ct => ct.topic_id);
        console.log('Loading existing topics for drop:', drop.id, 'Found topic IDs:', existingTopicIds);
        setSelectedTopics(existingTopicIds);
      }
    } catch (error) {
      console.error('Error in openEditTagsModal:', error);
      setSelectedTopics([]);
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
                          {drop.topic_labels && drop.topic_labels.length > 0 ? (
                            drop.topic_labels.map((label, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {label}
                              </Badge>
                            ))
                          ) : drop.tags && drop.tags.length > 0 ? (
                            drop.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
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
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto">
                {[1, 2, 3].map(level => (
                  <div key={level} className="mb-4">
                    <Label className="text-sm font-medium">
                      Livello {level}
                    </Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {topics
                        .filter(topic => topic.level === level)
                        .map(topic => (
                          <label key={topic.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedTopics.includes(topic.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTopics(prev => [...prev, topic.id]);
                                } else {
                                  setSelectedTopics(prev => prev.filter(id => id !== topic.id));
                                }
                              }}
                            />
                            <span className="text-sm">{topic.label}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditTagsModal({ open: false })}>
                  Annulla
                </Button>
                <Button onClick={handleEditTags}>
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