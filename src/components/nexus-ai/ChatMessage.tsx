import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ChatMessage as Message } from '@/services/nexus-ai-service';
import { User, Bot, RefreshCw, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/context/auth-context';

// Base64 encoded SVG avatars
const NEXUS_AI_AVATAR = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#0284c7" /><path d="M30 35 L50 25 L70 35 L70 65 L50 75 L30 65 Z" fill="#ffffff" /><path d="M50 25 L50 55 L70 45 L70 35 Z" fill="#e0f2fe" /><path d="M30 35 L30 65 L50 75 L50 55 Z" fill="#bae6fd" /><circle cx="50" cy="45" r="5" fill="#0284c7" /></svg>')}`;

const USER_AVATAR = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#6b7280" /><circle cx="50" cy="35" r="15" fill="#f3f4f6" /><path d="M25 85 C25 65 75 65 75 85" fill="#f3f4f6" /></svg>')}`;

interface ChatMessageProps {
  message: Message;
  isLastUserMessage?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
}

export function ChatMessage({ 
  message, 
  isLastUserMessage = false,
  onRefresh,
  onEdit
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { user } = useAuth();
  const userName = user?.full_name || 'User';

  return (
    <div
      className={cn(
        'flex w-full items-start gap-4 p-4 relative',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex flex-col items-center">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src="/nexus-ai-avatar.svg" alt="NexusAI" className="p-1" />
            <AvatarFallback className="bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground mt-1">NexusAI</span>
        </div>
      )}
      <div
        className={cn(
          'rounded-lg px-4 py-2 max-w-[80%] relative',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : message.content ? (
          <ReactMarkdown className="text-sm prose prose-sm max-w-none">
            {message.content}
          </ReactMarkdown>
        ) : (
          <div className="flex items-center space-x-1 h-6">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
        
        {/* Action buttons for last user message */}
        {isUser && isLastUserMessage && (
          <div className="absolute -top-3 -right-3 flex space-x-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6 rounded-full bg-background shadow-sm"
                    onClick={onEdit}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Edit message</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6 rounded-full bg-background shadow-sm"
                    onClick={onRefresh}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Regenerate response</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex flex-col items-center">
          <Avatar className="h-10 w-10 border-2 border-secondary/20">
            <AvatarImage src="/user-avatar.svg" alt={userName} className="p-1" />
            <AvatarFallback className="bg-secondary">
              <User className="h-5 w-5 text-secondary-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground mt-1">{userName}</span>
        </div>
      )}
    </div>
  );
}
