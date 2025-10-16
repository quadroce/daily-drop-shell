import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Play, CheckCircle, XCircle, Clock, ArrowLeft, Linkedin } from 'lucide-react';
import { format } from 'date-fns';

interface SocialPost {
  id: number;
  topic_slug: string;
  date_key: string;
  article_count: number;
  status: string;
  error_message: string | null;
  post_url: string | null;
  slot_time: string;
  created_at: string;
  posted_at: string | null;
}

const LinkedInArchive = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [nextRun, setNextRun] = useState<{ morning: string; afternoon: string } | null>(null);

  useEffect(() => {
    checkAccess();
    loadData();
  }, []);

  const checkAccess = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      navigate('/admin');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load feature toggle
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'linkedin_archive_enabled')
        .maybeSingle();

      const settingValue = setting?.value as { enabled?: boolean } | null;
      setEnabled(settingValue?.enabled ?? false);

      // Load recent posts (last 30)
      const { data: postsData } = await supabase
        .from('social_posts')
        .select('*')
        .eq('platform', 'linkedin')
        .eq('kind', 'archive_share')
        .order('slot_time', { ascending: false })
        .limit(30);

      setPosts(postsData || []);

      // Calculate next run times (12:05 and 17:16 CET)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const morningTime = new Date(tomorrow);
      morningTime.setHours(12, 5, 0, 0);
      const afternoonTime = new Date(tomorrow);
      afternoonTime.setHours(17, 16, 0, 0);

      setNextRun({
        morning: morningTime.toISOString(),
        afternoon: afternoonTime.toISOString()
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    setIsToggling(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'linkedin_archive_enabled',
          value: { enabled: newValue }
        });

      if (error) throw error;

      setEnabled(newValue);
      toast({
        title: newValue ? 'Enabled' : 'Disabled',
        description: `LinkedIn archive sharing is now ${newValue ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      console.error('Toggle error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive'
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunningNow(true);
    try {
      // Trigger both slots
      const morning = await supabase.functions.invoke('linkedin-archive-share', {
        body: { slot: 'morning', trigger: 'manual' }
      });

      const afternoon = await supabase.functions.invoke('linkedin-archive-share', {
        body: { slot: 'afternoon', trigger: 'manual' }
      });

      if (morning.error) throw morning.error;
      if (afternoon.error) throw afternoon.error;

      toast({
        title: 'Success',
        description: 'LinkedIn archive shares triggered. Check the log below for results.'
      });

      // Reload data after a delay
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Run now error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to trigger posts',
        variant: 'destructive'
      });
    } finally {
      setIsRunningNow(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'posted':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Posted</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'queued':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Queued</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">LinkedIn Archive Shares</h1>
          <p className="text-muted-foreground">
            Automated daily posts linking to topic archive pages
          </p>
        </div>
      </div>

      {/* Status & Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="w-5 h-5" />
            Status & Controls
          </CardTitle>
          <CardDescription>
            Manage automated LinkedIn posting for daily topic archives
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Auto-Posting</h3>
              <p className="text-sm text-muted-foreground">
                {enabled ? 'Active - Posts will be published at scheduled times' : 'Disabled - No automatic posts'}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isToggling}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Yesterday's Window</h3>
              <p className="text-sm text-muted-foreground">
                {yesterdayStr} 00:00 - 23:59 (Europe/Rome)
              </p>
            </div>
            {nextRun && (
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Next Scheduled Runs</h3>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">Morning: {format(new Date(nextRun.morning), 'HH:mm')} CET</p>
                  <p className="text-muted-foreground">Afternoon: {format(new Date(nextRun.afternoon), 'HH:mm')} CET</p>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleRunNow}
            disabled={isRunningNow}
            className="w-full md:w-auto"
          >
            {isRunningNow ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Triggers both morning and afternoon slots immediately using current rules
          </p>
        </CardContent>
      </Card>

      {/* Recent Posts Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts (Last 30)</CardTitle>
          <CardDescription>
            Post outcomes including scheduled, posted, and failed attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No posts yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slot Time</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="text-sm">
                        {format(new Date(post.slot_time), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{post.topic_slug}</TableCell>
                      <TableCell className="text-sm">{post.date_key}</TableCell>
                      <TableCell className="text-center">{post.article_count}</TableCell>
                      <TableCell>{getStatusBadge(post.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.posted_at ? format(new Date(post.posted_at), 'HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell>
                        {post.post_url && (
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            View
                          </a>
                        )}
                        {post.error_message && (
                          <span className="text-xs text-destructive" title={post.error_message}>
                            Error
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-mono">LinkedIn UGC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Post Type</span>
            <span>Text post with article link</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Content Source</span>
            <span>daily_topic_summaries (with fallback)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Selection Logic</span>
            <span>Top 2 by article count, tie-break by latest update</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">UTM Tracking</span>
            <span>source=linkedin, medium=post, campaign=archive-{`{slug}`}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkedInArchive;
