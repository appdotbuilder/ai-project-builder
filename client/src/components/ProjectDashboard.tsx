import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, FolderOpen, Calendar, Edit3, Trash2, Sparkles } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, Project, CreateProjectInput } from '../../../server/src/schema';

interface ProjectDashboardProps {
  user: User;
  onProjectSelect: (project: Project) => void;
}

export function ProjectDashboard({ user, onProjectSelect }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateProjectInput>({
    name: '',
    description: null,
    user_id: user.id,
    metadata: undefined
  });

  const loadProjects = useCallback(async () => {
    try {
      setError(null);
      const result = await trpc.getProjects.query({ userId: user.id });
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load projects. Please try refreshing the page.');
    }
  }, [user.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const newProject = await trpc.createProject.mutate(createForm);
      setProjects((prev: Project[]) => [newProject, ...prev]);
      setCreateForm({
        name: '',
        description: null,
        user_id: user.id,
        metadata: undefined
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      setError('Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user.name} 👋
            </h1>
            <p className="text-gray-400">
              Manage your AI-powered projects and bring your ideas to life.
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Project</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Start a new AI-powered project. You can add files and generate code later.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <Alert className="bg-red-950 border-red-800">
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <Label htmlFor="project-name" className="text-gray-300">Project Name</Label>
                  <Input
                    id="project-name"
                    value={createForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreateForm((prev: CreateProjectInput) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    placeholder="My Awesome App"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="project-description" className="text-gray-300">Description (Optional)</Label>
                  <Textarea
                    id="project-description"
                    value={createForm.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setCreateForm((prev: CreateProjectInput) => ({
                        ...prev,
                        description: e.target.value || null
                      }))
                    }
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    placeholder="Describe your project..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && !isCreateDialogOpen && (
        <Alert className="mb-6 bg-red-950 border-red-800">
          <AlertDescription className="text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-gray-800 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-12 h-12 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first AI-powered project to start building amazing applications with intelligent code generation.
          </p>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: Project) => (
            <Card 
              key={project.id} 
              className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer group"
              onClick={() => onProjectSelect(project)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-lg text-white group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                    Active
                  </Badge>
                </div>
                {project.description && (
                  <CardDescription className="text-gray-400 line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(project.updated_at)}
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement edit functionality
                      }}
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement delete functionality
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      {projects.length > 0 && (
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{projects.length}</p>
                  <p className="text-gray-400 text-sm">Total Projects</p>
                </div>
                <FolderOpen className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-gray-400 text-sm">AI Generations</p>
                </div>
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-gray-400 text-sm">Deployments</p>
                </div>
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}