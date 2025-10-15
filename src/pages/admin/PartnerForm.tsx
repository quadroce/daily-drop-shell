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
  const [topics, setTopics] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
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
    // In edit mode, fetch via admin API (would need to add this endpoint)
    // For now, use public getBySlug
    const slug = id; // Assuming id is slug for simplicity
    const data = await getPartnerBySlug(slug!);
    if (data) {
      setFormData({
        slug: data.partner.slug,
        name: data.partner.name,
        status: data.partner.status,
        scheduled_at: data.partner.scheduled_at || '',
        banner_url: data.partner.banner_url || '',
        youtube_url: data.partner.youtube_url || '',
        description_md: data.partner.description_md || '',
        links: data.links.length === 2 ? data.links.map(l => ({ ...l, utm: l.utm || '' })) : [
          { label: '', url: '', utm: '' },
          { label: '', url: '', utm: '' },
        ],
        topicIds: data.topics.map(t => t.id),
      });
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

    if (formData.links.some(l => !l.label || !l.url)) {
      toast({
        title: 'Error',
        description: 'Both links must have label and URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      if (isEdit) {
        await updatePartner(parseInt(id!), formData);
        toast({ title: 'Success', description: 'Partner updated' });
      } else {
        await createPartner(formData);
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
                <Label htmlFor="banner_url">Banner URL</Label>
                <Input
                  id="banner_url"
                  value={formData.banner_url}
                  onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                />
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
                <Label>Links (2 required)</Label>
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
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                {isEdit && (
                  <Button type="button" onClick={handlePublish} disabled={loading}>
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
  