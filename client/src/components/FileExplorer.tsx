import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  File, 
  Folder, 
  FolderOpen,
  Plus, 
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { ProjectFile } from '../../../server/src/schema';

interface FileExplorerProps {
  files: ProjectFile[];
  selectedFile: ProjectFile | null;
  onFileSelect: (file: ProjectFile) => void;
  onCreateFile: () => void;
  onRenameFile?: (file: ProjectFile, newName: string) => void;
  onDeleteFile?: (file: ProjectFile) => void;
}

interface FileTreeItem extends ProjectFile {
  children: FileTreeItem[];
  isExpanded?: boolean;
}

export function FileExplorer({ 
  files, 
  selectedFile, 
  onFileSelect, 
  onCreateFile,
  onRenameFile,
  onDeleteFile 
}: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<number>>(new Set());
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Build file tree structure
  const buildFileTree = (files: ProjectFile[]): FileTreeItem[] => {
    const tree: FileTreeItem[] = [];
    const map = new Map<number, FileTreeItem>();

    // Create FileTreeItem objects
    files.forEach((file: ProjectFile) => {
      const item: FileTreeItem = {
        ...file,
        children: [],
        isExpanded: expandedDirs.has(file.id)
      };
      map.set(file.id, item);
    });

    // Build parent-child relationships
    files.forEach((file: ProjectFile) => {
      const item = map.get(file.id)!;
      if (file.parent_id && map.has(file.parent_id)) {
        const parent = map.get(file.parent_id)!;
        parent.children.push(item);
      } else {
        tree.push(item);
      }
    });

    // Sort: directories first, then files
    const sortItems = (items: FileTreeItem[]): FileTreeItem[] => {
      return items.sort((a: FileTreeItem, b: FileTreeItem) => {
        if (a.file_type !== b.file_type) {
          return a.file_type === 'directory' ? -1 : 1;
        }
        return a.path.localeCompare(b.path);
      });
    };

    const sortRecursively = (items: FileTreeItem[]): FileTreeItem[] => {
      const sorted = sortItems(items);
      sorted.forEach((item: FileTreeItem) => {
        if (item.children.length > 0) {
          item.children = sortRecursively(item.children);
        }
      });
      return sorted;
    };

    return sortRecursively(tree);
  };

  const toggleDirectory = (dirId: number) => {
    setExpandedDirs((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(dirId)) {
        newSet.delete(dirId);
      } else {
        newSet.add(dirId);
      }
      return newSet;
    });
  };

  const handleRename = (file: ProjectFile) => {
    setRenamingFile(file);
    setRenameValue(file.path.split('/').pop() || '');
  };

  const confirmRename = () => {
    if (renamingFile && onRenameFile && renameValue.trim()) {
      const pathParts = renamingFile.path.split('/');
      pathParts[pathParts.length - 1] = renameValue.trim();
      const newPath = pathParts.join('/');
      onRenameFile(renamingFile, newPath);
    }
    setRenamingFile(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingFile(null);
    setRenameValue('');
  };

  const getFileIcon = (file: FileTreeItem) => {
    if (file.file_type === 'directory') {
      return file.isExpanded ? (
        <FolderOpen className="w-4 h-4 text-blue-400" />
      ) : (
        <Folder className="w-4 h-4 text-blue-400" />
      );
    }

    const extension = file.path.split('.').pop()?.toLowerCase();
    const iconClass = "w-4 h-4";
    
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return <File className={`${iconClass} text-blue-400`} />;
      case 'ts':
      case 'js':
        return <File className={`${iconClass} text-yellow-400`} />;
      case 'css':
      case 'scss':
        return <File className={`${iconClass} text-blue-300`} />;
      case 'json':
        return <File className={`${iconClass} text-green-400`} />;
      case 'md':
        return <File className={`${iconClass} text-gray-400`} />;
      case 'html':
        return <File className={`${iconClass} text-orange-400`} />;
      default:
        return <File className={`${iconClass} text-gray-400`} />;
    }
  };

  const renderFileTreeItem = (item: FileTreeItem, depth: number = 0): React.ReactNode => {
    const isSelected = selectedFile?.id === item.id;
    const fileName = item.path.split('/').pop() || item.path;
    const isRenaming = renamingFile?.id === item.id;

    return (
      <div key={item.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center space-x-1 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-800 ${
                isSelected ? 'bg-gray-800 text-blue-400' : 'text-gray-300'
              }`}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
              onClick={() => {
                if (item.file_type === 'directory') {
                  toggleDirectory(item.id);
                } else {
                  onFileSelect(item);
                }
              }}
            >
              {item.file_type === 'directory' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDirectory(item.id);
                  }}
                  className="p-0.5 hover:bg-gray-700 rounded"
                >
                  {item.isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
              
              {getFileIcon(item)}
              
              {isRenaming ? (
                <Input
                  value={renameValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmRename();
                    } else if (e.key === 'Escape') {
                      cancelRename();
                    }
                  }}
                  onBlur={confirmRename}
                  className="h-6 px-1 text-xs bg-gray-700 border-gray-600"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate flex-1">{fileName}</span>
              )}
            </div>
          </ContextMenuTrigger>
          
          <ContextMenuContent className="bg-gray-800 border-gray-700">
            {item.file_type === 'directory' && (
              <ContextMenuItem
                onClick={() => onCreateFile()}
                className="text-gray-300 hover:bg-gray-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New File
              </ContextMenuItem>
            )}
            {onRenameFile && (
              <ContextMenuItem
                onClick={() => handleRename(item)}
                className="text-gray-300 hover:bg-gray-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Rename
              </ContextMenuItem>
            )}
            {onDeleteFile && (
              <ContextMenuItem
                onClick={() => onDeleteFile(item)}
                className="text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {item.file_type === 'directory' && item.isExpanded && (
          <div>
            {item.children.map((child: FileTreeItem) => renderFileTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = buildFileTree(files);

  return (
    <div className="h-full">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Files</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateFile}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="p-2 overflow-y-auto">
        {fileTree.length === 0 ? (
          <div className="text-center py-8">
            <File className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No files yet</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCreateFile}
              className="text-gray-400 hover:text-white"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create file
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fileTree.map((item: FileTreeItem) => renderFileTreeItem(item))}
          </div>
        )}
      </div>
    </div>
  );
}