import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning';
  message: string;
}

interface DebugLogsProps {
  logs: LogEntry[];
}

export function DebugLogs({ logs }: DebugLogsProps) {
  const [open, setOpen] = useState(false);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bug className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>NexusAI Debug Logs</DialogTitle>
          <DialogDescription>
            View logs and debug information for NexusAI integration.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No logs available</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="py-1">
                  <span className="text-gray-500">{log.timestamp}</span>{' '}
                  <span className={`font-bold ${getLevelColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>{' '}
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

