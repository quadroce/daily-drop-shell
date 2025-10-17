import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Loader2, Play, Lock, AlertTriangle, CheckCircle, Clock, RefreshCw, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface CronJob {
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  description?: string;
  cron_expression?: string;
  last_run?: string;
  next_run?: string;
  success_rate_7d?: number;
  last_error?: string;
  is_running?: boolean;
}

interface CronExecution {
  id: number;
  job_name: string;
  executed_at: string;
  success: boolean;
  response_status: number;
  error_message: string;
}

export default function AdminCron() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [jobLogs, setJobLogs] = useState<CronExecution[]>([]);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAccess();
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkAccess = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
        navigate('/feed');
        toast({
          title: 'Access Denied',
          description: 'You need admin privileges to access this page.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Access check failed:', error);
      navigate('/feed');
    }
  };

  const fetchJobs = async () => {
    try {
      // Fetch cron jobs
      const { data: cronData } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('name');

      // Fetch recent executions for each job
      const { data: executionsData } = await supabase
        .from('cron_execution_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100);

      // Calculate stats per job
      const jobsWithStats = cronData?.map((job) => {
        const jobExecutions = executionsData?.filter((ex) => ex.job_name === job.name) || [];
        const last7Days = jobExecutions.filter(
          (ex) => new Date(ex.executed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        const successRate = last7Days.length > 0
          ? (last7Days.filter((ex) => ex.success).length / last7Days.length) * 100
          : 100;

        const lastExecution = jobExecutions[0];
        const lastError = lastExecution && !lastExecution.success ? lastExecution.error_message : null;

        return {
          ...job,
          description: getJobDescription(job.name),
          cron_expression: '*/10 * * * *', // Placeholder - adjust as needed
          last_run: lastExecution?.executed_at || null,
          next_run: null, // Placeholder - would need scheduler info
          success_rate_7d: successRate,
          last_error: lastError,
          is_running: runningJobs.has(job.name),
        };
      }) || [];

      setJobs(jobsWithStats);
    } catch (error) {
      console.error('Error fetching cron jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch cron jobs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getJobDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      'auto-ingest-worker': 'Automated RSS feed ingestion and content processing',
      'tag-drops': 'Tag and categorize content drops',
      'newsletter': 'Send scheduled newsletters',
      'cleanup': 'Clean up old logs and temporary data',
    };
    return descriptions[name] || 'Scheduled task';
  };

  const toggleJob = async (name: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('name', name);

      if (error) throw error;

      setJobs((prev) =>
        prev.map((job) => (job.name === name ? { ...job, enabled } : job))
      );

      toast({
        title: enabled ? 'Job Enabled' : 'Job Disabled',
        description: `${name} has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling job:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle job status',
        variant: 'destructive',
      });
    }
  };

  const runJobNow = async (name: string) => {
    if (runningJobs.has(name)) {
      toast({
        title: 'Job Running',
        description: 'This job is already running',
        variant: 'destructive',
      });
      return;
    }

    setRunningJobs((prev) => new Set(prev).add(name));

    try {
      // Call the appropriate edge function based on job name
      const functionMap: Record<string, string> = {
        'auto-ingest-worker': 'automated-ingestion',
        'tag-drops': 'tag-drops',
        'newsletter': 'send-newsletters',
      };

      const functionName = functionMap[name];
      if (!functionName) {
        throw new Error('Unknown job type');
      }

      const { error } = await supabase.functions.invoke(functionName, {
        body: { trigger: 'manual_admin' },
      });

      if (error) throw error;

      toast({
        title: 'Job Started',
        description: `${name} has been triggered`,
      });

      setTimeout(() => {
        fetchJobs();
        setRunningJobs((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }, 5000);
    } catch (error) {
      console.error('Error running job:', error);
      toast({
        title: 'Error',
        description: 'Failed to run job',
        variant: 'destructive',
      });
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const viewLogs = async (job: CronJob) => {
    setSelectedJob(job);
    
    try {
      const { data } = await supabase
        .from('cron_execution_log')
        .select('*')
        .eq('job_name', job.name)
        .order('executed_at', { ascending: false })
        .limit(20);

      setJobLogs(data || []);
    } catch (error) {
      console.error('Error fetching job logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch job logs',
        variant: 'destructive',
      });
    }
  };

  const getHealthBadge = (successRate: number = 100) => {
    if (successRate >= 95) return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />Healthy</Badge>;
    if (successRate >= 80) return <Badge variant="secondary" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
    return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Critical</Badge>;
  };

  const formatRomeTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      // Add 1 hour for Rome time (UTC+1, or UTC+2 during DST)
      const date = new Date(dateStr);
      date.setHours(date.getHours() + 1);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch {
      return '—';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Cron Jobs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Cron Jobs</h1>
            <p className="text-muted-foreground mt-1">Manage scheduled tasks and view execution logs</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>All times in Europe/Rome timezone</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>CRON</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run (Rome)</TableHead>
                <TableHead>Success Rate (7d)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.name}>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {job.description}
                  </TableCell>
                  <TableCell className="text-xs">
                    {job.cron_expression}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(checked) => toggleJob(job.name, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatRomeTime(job.last_run)}</div>
                    {job.last_error && (
                      <div className="text-xs text-red-600 truncate max-w-xs" title={job.last_error}>
                        {job.last_error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getHealthBadge(job.success_rate_7d)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runJobNow(job.name)}
                        disabled={job.is_running || !job.enabled}
                      >
                        {job.is_running ? (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Running
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Run Now
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewLogs(job)}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Logs
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Job Logs Sheet */}
      <Sheet open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedJob?.name} - Execution Logs</SheetTitle>
            <SheetDescription>Last 20 runs in Europe/Rome timezone</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {jobLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <Badge variant="outline">Status: {log.response_status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {formatRomeTime(log.executed_at)}
                  </div>
                  {log.error_message && (
                    <div className="text-sm text-red-600 mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                      {log.error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {jobLogs.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No execution logs found
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
