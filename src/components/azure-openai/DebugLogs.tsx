import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const DebugLogs: React.FC = () => {
  const { logs, clearLogs } = useAzureOpenAI();
  const [isExpanded, setIsExpanded] = useState(false);

  if (logs.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Debug Logs</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearLogs()}
            className="h-7 w-7 p-0"
            title="Clear logs"
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
          <ScrollArea className="h-[200px] rounded-md border p-2">
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, index) => (
                <div key={index} className="break-all">
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default DebugLogs;

