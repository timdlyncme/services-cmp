import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { ChevronDown, ChevronUp, Trash2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogLevel } from "@/contexts/AzureOpenAIContext";

const DebugLogs: React.FC = () => {
  const { logs, clearLogs } = useAzureOpenAI();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const getLogLevelColor = (level: LogLevel) => {
    switch (level) {
      case "error": return "bg-destructive text-destructive-foreground";
      case "warning": return "bg-amber-500 text-white";
      case "success": return "bg-green-500 text-white";
      case "request": return "bg-blue-500 text-white";
      case "response": return "bg-purple-500 text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      return timestamp;
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return null;
    
    try {
      return JSON.stringify(details, null, 2);
    } catch (e) {
      return String(details);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          Debug Logs {logs.length > 0 && <span className="text-xs text-muted-foreground ml-2">({logs.length})</span>}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="h-7 px-2 text-xs"
            title={showDetails ? "Hide details" : "Show details"}
            disabled={logs.length === 0}
          >
            {showDetails ? (
              <>
                <EyeOff className="h-3.5 w-3.5 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Show Details
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearLogs()}
            className="h-7 w-7 p-0"
            title="Clear logs"
            disabled={logs.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="px-4 py-2">
          <ScrollArea className="h-[300px] rounded-md border p-2">
            <div className="space-y-2 font-mono text-xs">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div key={index} className="pb-2 border-b border-border last:border-0">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className={`${getLogLevelColor(log.level)} uppercase text-[10px] font-bold`}>
                        {log.level}
                      </Badge>
                      <div className="text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div className="flex-1 break-all">
                        {log.message}
                      </div>
                    </div>
                    
                    {showDetails && log.details && (
                      <div className="mt-1 ml-14 bg-muted p-2 rounded text-[10px] overflow-x-auto">
                        <pre>{formatDetails(log.details)}</pre>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No logs to display
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default DebugLogs;
