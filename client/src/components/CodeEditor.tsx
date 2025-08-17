import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Copy, Download, RotateCcw } from 'lucide-react';
import type { ProjectFile } from '../../../server/src/schema';

interface CodeEditorProps {
  file: ProjectFile;
  onSave: (content: string) => void;
}

export function CodeEditor({ file, onSave }: CodeEditorProps) {
  const [content, setContent] = useState(file.content);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Update content when file changes
  useEffect(() => {
    setContent(file.content);
    setHasChanges(false);
  }, [file.id, file.content]);

  // Track changes
  useEffect(() => {
    setHasChanges(content !== file.content);
  }, [content, file.content]);

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      await onSave(content);
      setHasChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const handleReset = () => {
    setContent(file.content);
    setHasChanges(false);
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileLanguage = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsx': return 'TypeScript React';
      case 'jsx': return 'JavaScript React';
      case 'ts': return 'TypeScript';
      case 'js': return 'JavaScript';
      case 'css': return 'CSS';
      case 'scss': return 'SCSS';
      case 'json': return 'JSON';
      case 'md': return 'Markdown';
      case 'html': return 'HTML';
      case 'py': return 'Python';
      default: return 'Text';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-white">
            {file.path.split('/').pop()}
          </span>
          <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
            {getFileLanguage(file.path)}
          </Badge>
          {hasChanges && (
            <Badge variant="secondary" className="text-xs bg-orange-600 text-white">
              Modified
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {lastSaved && (
            <span className="text-xs text-gray-500">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyContent}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            title="Copy content"
          >
            <Copy className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            title="Download file"
          >
            <Download className="w-3 h-3" />
          </Button>

          {hasChanges && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              title="Reset changes"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            title="Save (Cmd+S)"
          >
            <Save className="w-3 h-3 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4">
        <Textarea
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none bg-gray-900 border-gray-700 text-gray-100 font-mono text-sm leading-relaxed"
          placeholder="Start typing your code..."
          style={{
            minHeight: '100%',
            tabSize: 2,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace"
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>Lines: {content.split('\n').length}</span>
          <span>Characters: {content.length}</span>
          <span>Size: {new Blob([content]).size} bytes</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>UTF-8</span>
          <span>{getFileLanguage(file.path)}</span>
        </div>
      </div>
    </div>
  );
}