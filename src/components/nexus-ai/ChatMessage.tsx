import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ChatMessage as Message } from '@/services/nexus-ai-service';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full items-start gap-4 p-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </Avatar>
      )}
      <div
        className={cn(
          'rounded-lg px-4 py-2 max-w-[80%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <ReactMarkdown className="text-sm prose prose-sm max-w-none">
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </Avatar>
      )}
    </div>
  );
}

