import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { 
  File, 
  Folder, 
  Plus, 
  Save, 
  Play, 
  Sparkles, 
  Upload, 
  Download,
  ChevronRight,
  ChevronDown,
  Code2,
  Zap,
  Settings
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { FileExplorer } from '@/components/FileExplorer';
import { CodeEditor } from '@/components/CodeEditor';
import { AiAssistant } from '@/components/AiAssistant';
import type { User, Project, ProjectFile, CreateProjectFileInput } from '../../../server/src/schema';

interface ProjectWorkspaceProps {
  user: User;
  project: Project;
  onBackToDashboard: () => void;
}

export function ProjectWorkspace({ user, project, onBackToDashboard }: ProjectWorkspaceProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateFileDialogOpen, setIsCreateFileDialogOpen] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  const [createFileForm, setCreateFileForm] = useState<CreateProjectFileInput>({
    project_id: project.id,
    path: '',
    content: '',
    file_type: 'file',
    parent_id: null
  });

  const loadProjectFiles = useCallback(async () => {
    try {
      setError(null);
      const result = await trpc.getProjectFiles.query({ 
        projectId: project.id, 
        userId: user.id 
      });
      setFiles(result);
    } catch (error) {
      console.error('Failed to load project files:', error);
      setError('Failed to load project files. Please try refreshing.');
    }
  }, [project.id, user.id]);

  useEffect(() => {
    loadProjectFiles();
  }, [loadProjectFiles]);

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const newFile = await trpc.createProjectFile.mutate({
        ...createFileForm,
        userId: user.id
      });
      setFiles((prev: ProjectFile[]) => [...prev, newFile]);
      setCreateFileForm({
        project_id: project.id,
        path: '',
        content: '',
        file_type: 'file',
        parent_id: null
      });
      setIsCreateFileDialogOpen(false);
    } catch (error) {
      console.error('Failed to create file:', error);
      setError('Failed to create file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFile = async (file: ProjectFile, content: string) => {
    try {
      const updatedFile = await trpc.updateProjectFile.mutate({
        id: file.id,
        content,
        userId: user.id
      });
      
      setFiles((prev: ProjectFile[]) =>
        prev.map((f: ProjectFile) => f.id === file.id ? { ...f, content } : f)
      );
      
      if (selectedFile?.id === file.id) {
        setSelectedFile({ ...selectedFile, content });
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      setError('Failed to save file. Please try again.');
    }
  };

  const getFileIcon = (fileName: string, fileType: string) => {
    if (fileType === 'directory') return <Folder className="w-4 h-4 text-blue-400" />;
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      case 'ts':
      case 'js':
        return <File className="w-4 h-4 text-yellow-400" />;
      case 'css':
        return <File className="w-4 h-4 text-blue-400" />;
      case 'json':
        return <File className="w-4 h-4 text-green-400" />;
      case 'md':
        return <File className="w-4 h-4 text-gray-400" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-gray-400">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => setShowAiAssistant(!showAiAssistant)}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Assistant
            </Button>

            <Dialog open={isCreateFileDialogOpen} onOpenChange={setIsCreateFileDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-1" />
                  New File
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New File</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Add a new file or folder to your project.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateFile} className="space-y-4">
                  <div>
                    <Label htmlFor="file-type" className="text-gray-300">Type</Label>
                    <Select
                      value={createFileForm.file_type}
                      onValueChange={(value: 'file' | 'directory') =>
                        setCreateFileForm((prev: CreateProjectFileInput) => ({ ...prev, file_type: value }))
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="directory">Directory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="file-path" className="text-gray-300">Path</Label>
                    <Input
                      id="file-path"
                      value={createFileForm.path}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCreateFileForm((prev: CreateProjectFileInput) => ({ ...prev, path: e.target.value }))
                      }
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      placeholder={createFileForm.file_type === 'file' ? 'src/App.tsx' : 'src/components'}
                      required
                    />
                  </div>

                  {createFileForm.file_type === 'file' && (
                    <div>
                      <Label htmlFor="file-content" className="text-gray-300">Initial Content (Optional)</Label>
                      <Textarea
                        id="file-content"
                        value={createFileForm.content}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setCreateFileForm((prev: CreateProjectFileInput) => ({ ...prev, content: e.target.value }))
                        }
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 font-mono text-sm"
                        placeholder="// Your code here..."
                        rows={8}
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateFileDialogOpen(false)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled
            >
              <Zap className="w-4 h-4 mr-1" />
              Deploy
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mt-3 bg-red-950 border-red-800">
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full bg-gray-900 border-r border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-medium text-gray-300">Explorer</h3>
              </div>
              <div className="p-2">
                {files.length === 0 ? (
                  <div className="text-center py-8">
                    <File className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No files yet</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsCreateFileDialogOpen(true)}
                      className="mt-2 text-gray-400 hover:text-white"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add file
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {files.map((file: ProjectFile) => (
                      <div
                        key={file.id}
                        className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-800 ${
                          selectedFile?.id === file.id ? 'bg-gray-800 text-blue-400' : 'text-gray-300'
                        }`}
                        onClick={() => file.file_type === 'file' ? setSelectedFile(file) : undefined}
                      >
                        {getFileIcon(file.path, file.file_type)}
                        <span className="text-sm truncate flex-1">
                          {file.path.split('/').pop()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Editor */}
          <ResizablePanel defaultSize={showAiAssistant ? 50 : 80}>
            <div className="h-full bg-gray-950">
              {selectedFile ? (
                <CodeEditor 
                  file={selectedFile} 
                  onSave={(content: string) => handleSaveFile(selectedFile, content)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Code2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-300 mb-2">No file selected</h3>
                    <p className="text-gray-500 mb-4">
                      Select a file from the explorer or create a new one to start coding.
                    </p>
                    <Button
                      onClick={() => setIsCreateFileDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          {/* AI Assistant */}
          {showAiAssistant && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
                <AiAssistant 
                  project={project}
                  user={user}
                  onClose={() => setShowAiAssistant(false)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}