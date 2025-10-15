import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, BarChart3 } from 'lucide-react';
import { listPartners } from '@/lib/api/partners';
import RequireRole from '@/components/RequireRole';
import Layout from '@/components/Layout';
import { Seo } from '@/components/Seo';

export default function Partners() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    try {
      const { partners } = await listPartners();
      setPartners(partners || []);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: 'secondary',
      published: 'default',
      scheduled: 'outline',
      archived: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  }

  return (
    <RequireRole minRole="editor">
      <Seo title="Partners | Admin" />
      
      <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Partners</h1>
              <p className="text-muted-foreground">
                Manage partner pages and track engagement
              </p>
            </div>
            <Button onClick={() => navigate('/admin/partners/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Partner
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Link Clicks</TableHead>
                  <TableHead className="text-right">Follows</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : partners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No partners yet. Create your first partner page.
                    </TableCell>
                  </TableRow>
                ) : (
                  partners.map((partner) => {
                    const kpi = partner.partner_kpi?.[0] || { views: 0, link_clicks: 0, follows: 0 };
                    return (
                      <TableRow key={partner.id}>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>
                          <code className="text-sm">/{partner.slug}</code>
                        </TableCell>
                        <TableCell>{getStatusBadge(partner.status)}</TableCell>
                        <TableCell>
                          {partner.scheduled_at
                            ? new Date(partner.scheduled_at).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">{kpi.views || 0}</TableCell>
                        <TableCell className="text-right">{kpi.link_clicks || 0}</TableCell>
                        <TableCell className="text-right">{kpi.follows || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/${partner.slug}`, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/partners/${partner.id}`)}
                            >
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </RequireRole>
    );
  }
  