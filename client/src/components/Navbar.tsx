import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Code2, LogOut, User as UserIcon } from 'lucide-react';
import type { User, Project } from '../../../server/src/schema';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onBackToDashboard?: () => void;
  currentProject?: Project | null;
}

export function Navbar({ user, onLogout, onBackToDashboard, currentProject }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {onBackToDashboard && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToDashboard}
                className="text-gray-300 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            )}
            
            <div className="flex items-center space-x-3">
              <Code2 className="w-6 h-6 text-blue-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Builder
              </span>
            </div>

            {currentProject && (
              <div className="flex items-center space-x-2 ml-6">
                <span className="text-gray-400 text-sm">Project:</span>
                <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700">
                  {currentProject.name}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <UserIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}