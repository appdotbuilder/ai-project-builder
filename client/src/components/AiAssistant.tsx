import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Send, 
  Code2, 
  FileText, 
  Layers,
  Wand2,
  X,
  Bot,
  User as UserIcon,
  Lightbulb
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, Project, AiGenerationRequest } from '../../../server/src/schema';

interface AiAssistantProps {
  project: Project;
  user: User;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    generationType?: string;
    filePath?: string;
    status?: 'generating' | 'success' | 'error';
  };
}

export function AiAssistant({ project, user, onClose }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: `Welcome to AI Assistant! I'm here to help you build your project "${project.name}". I can help you with:

• Generate React components
• Create utility functions  
• Write documentation
• Suggest architecture improvements
• Debug code issues

What would you like to work on?`,
      timestamp: new Date()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [generationType, setGenerationType] = useState<'file' | 'component' | 'feature' | 'full_app'>('component');
  const [filePath, setFilePath] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages((prev: ChatMessage[]) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);

    // Add user message
    addMessage({
      type: 'user',
      content: userMessage
    });

    // Add generating message
    const generatingMessageId = Date.now().toString();
    addMessage({
      type: 'assistant',
      content: 'Generating your request...',
      metadata: {
        generationType,
        filePath: filePath || undefined,
        status: 'generating'
      }
    });

    setIsGenerating(true);

    try {
      const aiRequest: AiGenerationRequest = {
        project_id: project.id,
        prompt: userMessage,
        file_path: filePath || undefined,
        generation_type: generationType
      };

      // This is a placeholder call - the actual implementation would be in the backend
      const response = await trpc.generateWithAi.mutate({
        ...aiRequest,
        userId: user.id
      });

      // Update the generating message with the response
      setMessages((prev: ChatMessage[]) =>
        prev.map((msg: ChatMessage) =>
          msg.id === generatingMessageId
            ? {
                ...msg,
                content: response.generated_content || response.message || 'AI generation completed! The generated content has been added to your project.',
                metadata: {
                  ...msg.metadata,
                  status: 'success'
                }
              }
            : msg
        )
      );

    } catch (error) {
      console.error('AI generation failed:', error);
      
      // Update with error message - showing placeholder functionality
      setMessages((prev: ChatMessage[]) =>
        prev.map((msg: ChatMessage) =>
          msg.id === generatingMessageId
            ? {
                ...msg,
                content: `🚧 **AI Generation (Coming Soon)** 

I would help you generate ${generationType} based on your request: "${userMessage}"

**Planned Features:**
• Intelligent code generation using GPT-4
• Context-aware suggestions based on your project
• Automatic file creation and updates
• Code review and optimization suggestions

This feature is currently in development and will be available in a future update!`,
                metadata: {
                  ...msg.metadata,
                  status: 'error'
                }
              }
            : msg
        )
      );

      setError('AI generation is currently in development. This is a preview of the planned functionality.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>')
      .replace(/^• (.+)$/gm, '<div class="flex items-start"><span class="text-blue-400 mr-2">•</span><span>$1</span></div>')
      .replace(/\n/g, '<br />');
  };

  const getGenerationIcon = (type: string) => {
    switch (type) {
      case 'file': return <FileText className="w-4 h-4" />;
      case 'component': return <Code2 className="w-4 h-4" />;
      case 'feature': return <Layers className="w-4 h-4" />;
      case 'full_app': return <Wand2 className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full bg-gray-900 border-l border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Assistant</h3>
              <p className="text-xs text-gray-400">Powered by AI</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <Alert className="mt-3 bg-amber-950 border-amber-800">
            <Lightbulb className="w-4 h-4" />
            <AlertDescription className="text-amber-200">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message: ChatMessage) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'system'
                    ? 'bg-gray-800 text-gray-300 border border-gray-700'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-start space-x-2 mb-2">
                  <div className="flex-shrink-0">
                    {message.type === 'user' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    {message.metadata?.generationType && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary" className="text-xs bg-purple-600 text-white">
                          {getGenerationIcon(message.metadata.generationType)}
                          <span className="ml-1 capitalize">{message.metadata.generationType}</span>
                        </Badge>
                        {message.metadata.filePath && (
                          <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                            {message.metadata.filePath}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                    />
                  </div>
                </div>
                <div className="text-xs opacity-50">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400">Generation Type</Label>
            <Select
              value={generationType}
              onValueChange={(value: 'file' | 'component' | 'feature' | 'full_app') => 
                setGenerationType(value)
              }
            >
              <SelectTrigger className="h-8 bg-gray-800 border-gray-600 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="component">Component</SelectItem>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="full_app">Full App</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-gray-400">Target Path (Optional)</Label>
            <Input
              value={filePath}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilePath(e.target.value)}
              className="h-8 bg-gray-800 border-gray-600 text-xs"
              placeholder="src/components/Button.tsx"
            />
          </div>
        </div>

        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask AI to generate code, explain concepts, or help with your project... (Cmd+Enter to send)"
            className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            disabled={isGenerating}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isGenerating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          AI Assistant is currently in development. Some features may not be fully functional.
        </p>
      </div>
    </div>
  );
}