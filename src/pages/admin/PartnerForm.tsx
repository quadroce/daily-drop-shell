import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createPartner, updatePartner, publishPartner, getPartnerBySlug } from '@/lib/api/partners';
import { supabase } from '@/integrations/supabase/client';
import RequireRole from '@/components/RequireRole';
import { Seo } from '@/components/Seo';
import { ArrowLeft, Save, Send } from 'lucide-react';

export default function PartnerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    title: '',
    logo_url: '',
    status: 'draft',
    scheduled_at: '',
    banner_url: '',
    youtube_url: '',
    description_md: '',
    links: [
      { label: '', url: '', utm: '' as string | undefined },
      { label: '', url: '', utm: '' as string | undefined },
    ],
    topicIds: [] as number[],
  });

  useEffect(() => {
    loadTopics();
    if (isEdit) {
      loadPartner();
    }
  }, [id]);

  async function loadTopics() {
    const { data } = await supabase
      .from('topics')
      .select('id, label, slug')
      .eq('is_active', true)
      .order('label');
    
    if (data) {
      setTopics(data);
    }
  }

  async function loadPartner() {
    try {
      console.log('🔄 Loading partner with ID:', id);
      
      // Load partner by ID (not slug)
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('id', parseInt(id!))
        .single();

      if (partnerError || !partner) {
        console.error('❌ Error loading partner:', partnerError);
        toast({
          title: 'Error',
          description: 'Failed to load partner',
          variant: 'destructive',
        });
        return;
      }

      // Load links
      const { data: links } = await supabase
        .from('partner_links')
        .select('*')
        .eq('partner_id', partner.id)
        .order('position');

      // Load topics
      const { data: partnerTopics } = await supabase
        .from('partner_topics')
        .select('topic_id')
        .eq('partner_id', partner.id);

      const topicIds = partnerTopics?.map(pt => pt.topic_id) || [];

      console.log('✅ Loaded partner:', partner);
      
      setFormData({
        slug: partner.slug,
        name: partner.name,
        title: partner.title || '',
        logo_url: partner.logo_url || '',
        status: partner.status,
        scheduled_at: partner.scheduled_at || '',
        banner_url: partner.banner_url || '',
        youtube_url: partner.youtube_url || '',
        description_md: partner.description_md || '',
        links: links && links.length > 0 ? links.map(l => ({ 
          label: l.label, 
          url: l.url, 
          utm: l.utm || '' 
        })) : [
          { label: '', url: '', utm: '' },
          { label: '', url: '', utm: '' },
        ],
        topicIds: topicIds,
      });
    } catch (error) {
      console.error('❌ Failed to load partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to load partner data',
        variant: 'destructive',
      });
    }
  }

  async function handleFileUpload(file: File, type: 'banner' | 'logo') {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.slug || 'new'}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `partners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('partner-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('partner-assets')
        .getPublicUrl(filePath);

      if (type === 'banner') {
        setFormData({ ...formData, banner_url: publicUrl });
      } else {
        setFormData({ ...formData, logo_url: publicUrl });
      }

      toast({
        title: 'Success',
        description: `${type === 'banner' ? 'Banner' : 'Logo'} uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.slug || !formData.name) {
      toast({
        title: 'Error',
        description: 'Slug and name are required',
        variant: 'destructive',
      });
      return;
    }

    // Validate only filled links
    const filledLinks = formData.links.filter(l => l.label || l.url);
    if (filledLinks.some(l => !l.label || !l.url)) {
      toast({
        title: 'Error',
        description: 'If you provide a link, both label and URL are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      // Clean up scheduled_at if status is published
      const dataToSend = { ...formData };
      if (formData.status === 'published') {
        dataToSend.scheduled_at = '';
      }
      
      if (isEdit) {
        await updatePartner(parseInt(id!), dataToSend);
        toast({ title: 'Success', description: 'Partner updated' });
      } else {
        await createPartner(dataToSend);
        toast({ title: 'Success', description: 'Partner created' });
      }
      
      navigate('/admin/partners');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!isEdit) return;
    
    try {
      setLoading(true);
      await publishPartner(parseInt(id!), formData.scheduled_at || undefined);
      toast({ title: 'Success', description: 'Partner published' });
      navigate('/admin/partners');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole minRole="editor">
      <Seo title={`${isEdit ? 'Edit' : 'New'} Partner | Admin`} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/partners')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Partners
          </Button>

          <h1 className="text-3xl font-bold mb-8">
            {isEdit ? 'Edit Partner' : 'New Partner'}
          </h1>

          <form onSubmit={handleSubmit}>
            <Card className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="aws"
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Amazon Web Services"
                  />
                </div>
              </div>

              {/* Title and Logo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Page Title (optional)</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Defaults to name if empty"
                  />
                </div>
                <div>
                  <Label htmlFor="logo">Logo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="logo-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'logo');
                      }}
                      disabled={uploading}
                    />
                  </div>
                  {formData.logo_url && (
                    <img src={formData.logo_url} alt="Logo preview" className="mt-2 h-12 w-auto" />
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scheduled_at">Scheduled At</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Media */}
              <div>
                <Label htmlFor="banner">Banner (16:9)</Label>
                <div className="space-y-2">
                  <Input
                    id="banner-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'banner');
                    }}
                    disabled={uploading}
                  />
                  {formData.banner_url && (
                    <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden">
                      <img src={formData.banner_url} alt="Banner preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <Label htmlFor="youtube_url">YouTube URL (replaces banner)</Label>
                <Input
                  id="youtube_url"
                  value={formData.youtube_url}
                  onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  value={formData.description_md}
                  onChange={(e) => setFormData({ ...formData, description_md: e.target.value })}
                  rows={8}
                  placeholder="# About AWS..."
                />
              </div>

              {/* Links */}
              <div className="space-y-4">
                <Label>Links (optional, max 2)</Label>
                {formData.links.map((link, idx) => (
                  <Card key={idx} className="p-4 space-y-3">
                    <h4 className="font-medium">Link {idx + 1}</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={link.label}
                          onChange={(e) => {
                            const newLinks = [...formData.links];
                            newLinks[idx].label = e.target.value;
                            setFormData({ ...formData, links: newLinks });
                          }}
                          placeholder="Get Started"
                        />
                      </div>
                      <div>
                        <Label>URL</Label>
                        <Input
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...formData.links];
                            newLinks[idx].url = e.target.value;
                            setFormData({ ...formData, links: newLinks });
                          }}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <Label>UTM</Label>
                        <Input
                          value={link.utm}
                          onChange={(e) => {
                            const newLinks = [...formData.links];
                            newLinks[idx].utm = e.target.value;
                            setFormData({ ...formData, links: newLinks });
                          }}
                          placeholder="utm_source=dd"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Topics */}
              <div>
                <Label>Associated Topics</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {topics.map(topic => (
                    <label key={topic.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.topicIds.includes(topic.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, topicIds: [...formData.topicIds, topic.id] });
                          } else {
                            setFormData({ ...formData, topicIds: formData.topicIds.filter(id => id !== topic.id) });
                          }
                        }}
                      />
                      <span className="text-sm">{topic.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading || uploading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                {isEdit && (
                  <Button type="button" onClick={handlePublish} disabled={loading || uploading}>
                    <Send className="h-4 w-4 mr-2" />
                    Publish
                  </Button>
                )}
              </div>
            </Card>
          </form>
        </div>
      </RequireRole>
    );
  }
  