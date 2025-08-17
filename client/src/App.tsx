import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { AuthPage } from '@/components/AuthPage';
import { ProjectDashboard } from '@/components/ProjectDashboard';
import { ProjectWorkspace } from '@/components/ProjectWorkspace';
import { Navbar } from '@/components/Navbar';
import type { User, Project } from '../../server/src/schema';

type AppState = 'auth' | 'dashboard' | 'workspace';

interface AppContext {
  user: User | null;
  currentProject: Project | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>('auth');
  const [context, setContext] = useState<AppContext>({
    user: null,
    currentProject: null
  });

  // Check for stored auth on app load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setContext(prev => ({ ...prev, user }));
        setAppState('dashboard');
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = useCallback((user: User) => {
    setContext(prev => ({ ...prev, user }));
    localStorage.setItem('user', JSON.stringify(user));
    setAppState('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setContext({ user: null, currentProject: null });
    localStorage.removeItem('user');
    setAppState('auth');
  }, []);

  const handleProjectSelect = useCallback((project: Project) => {
    setContext(prev => ({ ...prev, currentProject: project }));
    setAppState('workspace');
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setContext(prev => ({ ...prev, currentProject: null }));
    setAppState('dashboard');
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {context.user && (
        <Navbar 
          user={context.user} 
          onLogout={handleLogout}
          onBackToDashboard={appState === 'workspace' ? handleBackToDashboard : undefined}
          currentProject={context.currentProject}
        />
      )}
      
      <main className={context.user ? 'pt-16' : ''}>
        {appState === 'auth' && (
          <AuthPage onLogin={handleLogin} />
        )}
        
        {appState === 'dashboard' && context.user && (
          <ProjectDashboard 
            user={context.user} 
            onProjectSelect={handleProjectSelect} 
          />
        )}
        
        {appState === 'workspace' && context.user && context.currentProject && (
          <ProjectWorkspace 
            user={context.user} 
            project={context.currentProject}
            onBackToDashboard={handleBackToDashboard}
          />
        )}
      </main>
    </div>
  );
}

export default App;