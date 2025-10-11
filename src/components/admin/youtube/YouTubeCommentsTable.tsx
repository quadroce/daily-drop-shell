import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, ExternalLink, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface CommentJob {
  id: number;
  video_id: string;
  channel_id: string;
  video_title: string;
  video_description: string | null;
  topic_slug: string;
  status: string;
  text_original: string | null;
  text_variant: string | null;
  text_hash: string | null;
  external_comment_id: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  tries: number;
  last_error: string | null;
  next_retry_at: string | null;
  platform: string;
  locale: string;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
}

interface CommentEvent {
  id: number;
  created_at: string;
  phase: string;
  status: string;
  message: string;
  data: any;
}

export function YouTubeCommentsTable() {
  const [jobs, setJobs] = useState<CommentJob[]>([]);
  const [events, setEvents] = useState<Record<number, CommentEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [todayStats, setTodayStats] = useState({ posted: 0, errors: 0, cap: 50 });
  const { toast } = useToast();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("social_comment_jobs")
        .select("*")
        .eq("platform", "youtube")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (topicFilter) {
        query = query.ilike("topic_slug", `%${topicFilter}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setJobs(data || []);

      // Fetch today's stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: statsData } = await supabase
        .from("social_comment_jobs")
        .select("status")
        .eq("platform", "youtube")
        .gte("posted_at", todayStart.toISOString());

      const posted = statsData?.filter(j => j.status === "posted").length || 0;
      const errors = statsData?.filter(j => j.status === "error").length || 0;

      setTodayStats({ posted, errors, cap: 50 });
    } catch (error: any) {
      toast({
        title: "Error loading jobs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobEvents = async (jobId: number) => {
    if (events[jobId]) return; // Already loaded

    try {
      const { data, error } = await supabase
        .from("social_comment_events")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setEvents(prev => ({ ...prev, [jobId]: data || [] }));
    } catch (error: any) {
      toast({
        title: "Error loading events",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, topicFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      queued: "outline",
      processing: "secondary",
      posted: "default",
      ready: "secondary",
      error: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: label,
    });
  };

  const exportToCSV = () => {
    const headers = ["Posted At", "Status", "Video Title", "Topic", "Comment", "External ID", "Tries", "Error"];
    const rows = jobs.map(job => [
      job.posted_at || job.scheduled_for || job.created_at,
      job.status,
      job.video_title,
      job.topic_slug,
      job.text_original || "",
      job.external_comment_id || "",
      job.tries.toString(),
      job.last_error || "",
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-comments-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exported to CSV",
      description: `${jobs.length} jobs exported`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>YouTube Comments</CardTitle>
            <CardDescription>
              Manage and monitor comment jobs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Today</span>
            <span className="text-2xl font-bold">{todayStats.posted}/{todayStats.cap}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Errors</span>
            <span className="text-2xl font-bold text-destructive">{todayStats.errors}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Success Rate</span>
            <span className="text-2xl font-bold">
              {todayStats.posted > 0 
                ? ((todayStats.posted / (todayStats.posted + todayStats.errors)) * 100).toFixed(0)
                : 0}%
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter by topic..."
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No jobs found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Tries</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {job.posted_at 
                        ? format(new Date(job.posted_at), "MMM d, HH:mm")
                        : job.scheduled_for
                        ? format(new Date(job.scheduled_for), "MMM d, HH:mm")
                        : format(new Date(job.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.youtube.com/watch?v=${job.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline truncate"
                          title={job.video_title}
                        >
                          {job.video_title.substring(0, 40)}...
                        </a>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.topic_slug}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      {job.text_original ? (
                        <div className="text-sm line-clamp-2" title={job.text_original}>
                          {job.text_original}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={job.tries > 2 ? "text-destructive font-semibold" : ""}>
                        {job.tries}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {job.text_original && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(job.text_original!, "Comment text")}
                            title="Copy comment"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {job.external_comment_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(job.external_comment_id!, "Comment ID")}
                            title="Copy comment ID"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchJobEvents(job.id)}
                              title="View logs"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle>Job Events #{job.id}</SheetTitle>
                              <SheetDescription>
                                {job.video_title.substring(0, 60)}...
                              </SheetDescription>
                            </SheetHeader>

                            <div className="mt-6 space-y-4">
                              <div>
                                <h4 className="font-semibold mb-2">Job Details</h4>
                                <div className="space-y-1 text-sm">
                                  <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(job.status)}</div>
                                  <div><span className="text-muted-foreground">Video ID:</span> {job.video_id}</div>
                                  <div><span className="text-muted-foreground">Channel ID:</span> {job.channel_id}</div>
                                  <div><span className="text-muted-foreground">Topic:</span> {job.topic_slug}</div>
                                  {job.external_comment_id && (
                                    <div><span className="text-muted-foreground">Comment ID:</span> {job.external_comment_id}</div>
                                  )}
                                  {job.last_error && (
                                    <div className="text-destructive">
                                      <span className="text-muted-foreground">Error:</span> {job.last_error}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {job.text_original && (
                                <div>
                                  <h4 className="font-semibold mb-2">Generated Comment</h4>
                                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                                    {job.text_original}
                                  </div>
                                </div>
                              )}

                              {job.text_variant && (
                                <div>
                                  <h4 className="font-semibold mb-2">All Variants (GPT-5)</h4>
                                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                    {job.text_variant}
                                  </div>
                                </div>
                              )}

                              <div>
                                <h4 className="font-semibold mb-2">Event Log</h4>
                                {events[job.id] ? (
                                  <div className="space-y-2">
                                    {events[job.id].map((event) => (
                                      <div key={event.id} className="border rounded-md p-3 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                          <Badge variant={
                                            event.status === "success" ? "default" :
                                            event.status === "error" ? "destructive" : "secondary"
                                          }>
                                            {event.phase}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(event.created_at), "HH:mm:ss")}
                                          </span>
                                        </div>
                                        <div>{event.message}</div>
                                        {event.data && (
                                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                                            {JSON.stringify(event.data, null, 2)}
                                          </pre>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground text-sm">Loading events...</div>
                                )}
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
