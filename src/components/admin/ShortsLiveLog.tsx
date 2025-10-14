import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "info" | "error" | "warn";
  message: string;
}

interface ShortsLiveLogProps {
  isPublishing: boolean;
}

export const ShortsLiveLog = ({ isPublishing }: ShortsLiveLogProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("Waiting...");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPublishing) {
      setLogs([]);
      setCurrentStep("Waiting...");
      return;
    }

    // Start polling logs
    const fetchLogs = async () => {
      try {
        const response = await fetch(
          'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-publish/logs',
          {
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.text();
          const lines = data.split('\n').filter(line => line.trim());
          
          const newLogs = lines.map(line => {
            const parts = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+(INFO|ERROR|WARN)\s+(.+)/);
            if (parts) {
              return {
                timestamp: parts[1],
                level: parts[2].toLowerCase() as "info" | "error" | "warn",
                message: parts[3]
              };
            }
            return null;
          }).filter(Boolean) as LogEntry[];

          if (newLogs.length > 0) {
            setLogs(prev => [...prev, ...newLogs]);
            
            // Detect current step from logs
            const lastLog = newLogs[newLogs.length - 1];
            if (lastLog.message.includes("Step 1")) setCurrentStep("📝 Generating Script");
            else if (lastLog.message.includes("Step 2")) setCurrentStep("🎤 Generating TTS Audio");
            else if (lastLog.message.includes("Step 3")) setCurrentStep("🎬 Rendering Video");
            else if (lastLog.message.includes("Step 4")) setCurrentStep("⏳ Waiting for Render");
            else if (lastLog.message.includes("Step 5")) setCurrentStep("⬇️ Downloading Video");
            else if (lastLog.message.includes("Step 6")) setCurrentStep("🔑 Getting OAuth Token");
            else if (lastLog.message.includes("Step 7")) setCurrentStep("☁️ Uploading to YouTube");
            else if (lastLog.message.includes("✅ Video uploaded")) setCurrentStep("✅ Complete!");
          }
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };

    // Initial fetch
    fetchLogs();
    
    // Poll every 2 seconds
    const interval = setInterval(fetchLogs, 2000);

    return () => clearInterval(interval);
  }, [isPublishing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "info":
        return <CheckCircle2 className="h-3 w-3 text-blue-500" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500" />;
      case "warn":
        return <Clock className="h-3 w-3 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info":
        return "text-blue-600 dark:text-blue-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "warn":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Generation Log</CardTitle>
            <CardDescription>
              Real-time progress of video generation
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <Badge variant="default">{currentStep}</Badge>
              </>
            ) : (
              <Badge variant="secondary">Idle</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress Steps */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className={`p-2 rounded text-center ${currentStep.includes("Script") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              📝 Script
            </div>
            <div className={`p-2 rounded text-center ${currentStep.includes("TTS") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              🎤 TTS
            </div>
            <div className={`p-2 rounded text-center ${currentStep.includes("Rendering") || currentStep.includes("Waiting") || currentStep.includes("Downloading") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              🎬 Video
            </div>
            <div className={`p-2 rounded text-center ${currentStep.includes("YouTube") || currentStep.includes("Complete") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              ☁️ Upload
            </div>
          </div>

          {/* Log Console */}
          <div className="bg-black/90 rounded-lg p-4 font-mono text-xs">
            <ScrollArea className="h-96" ref={scrollRef}>
              {logs.length === 0 ? (
                <div className="text-gray-500 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Waiting for logs...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {getLevelIcon(log.level)}
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          {log.level.toUpperCase()}
                        </Badge>
                      </div>
                      <span className={`flex-1 ${getLevelColor(log.level)}`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Stats */}
          {logs.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                  {logs.filter(l => l.level === "info").length}
                </div>
                <div className="text-muted-foreground">Info</div>
              </div>
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                <div className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {logs.filter(l => l.level === "warn").length}
                </div>
                <div className="text-muted-foreground">Warnings</div>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                <div className="font-semibold text-red-600 dark:text-red-400">
                  {logs.filter(l => l.level === "error").length}
                </div>
                <div className="text-muted-foreground">Errors</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
