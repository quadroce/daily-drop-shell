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

    setLogs([{ timestamp: new Date().toISOString(), level: "info", message: "Starting video generation..." }]);
    setCurrentStep("📝 Generating Script");

    // Simulate progress (we'll get real logs from edge function events later)
    const steps = [
      { delay: 2000, step: "📝 Generating Script", message: "Calling OpenAI GPT-4o-mini for script..." },
      { delay: 5000, step: "🎤 Generating TTS Audio", message: "Creating voice audio with OpenAI TTS (voice: nova)..." },
      { delay: 8000, step: "🎤 Generating TTS Audio", message: "Saving TTS audio to Supabase Storage..." },
      { delay: 10000, step: "🎬 Rendering Video", message: "Building Shotstack payload..." },
      { delay: 12000, step: "🎬 Rendering Video", message: "Submitting render job to Shotstack..." },
      { delay: 15000, step: "⏳ Waiting for Render", message: "Polling Shotstack for completion..." },
    ];

    let timeoutIds: NodeJS.Timeout[] = [];
    
    steps.forEach(({ delay, step, message }) => {
      const id = setTimeout(() => {
        setCurrentStep(step);
        setLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          level: "info",
          message
        }]);
      }, delay);
      timeoutIds.push(id);
    });

    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
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
