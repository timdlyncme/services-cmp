import { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryGroupProps {
  categoryName: string;
  templateCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isFiltered?: boolean;
}

export default function CategoryGroup({
  categoryName,
  templateCount,
  isExpanded,
  onToggle,
  children,
  isFiltered = false
}: CategoryGroupProps) {
  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-all duration-200",
      isFiltered ? "ring-2 ring-primary/50 border-primary/50" : "border-border"
    )}>
      <Button
        variant="ghost"
        className="w-full justify-between p-4 h-auto hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <FolderOpen className="h-5 w-5 text-primary" />
            ) : (
              <Folder className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-semibold text-lg">{categoryName}</span>
          </div>
          <Badge variant="secondary" className="ml-2">
            {templateCount} {templateCount === 1 ? 'template' : 'templates'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Badge variant="outline" className="text-xs">
              Filtered
            </Badge>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </Button>
      
      <div className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="p-4 pt-0 border-t bg-muted/20">
          {children}
        </div>
      </div>
    </div>
  );
}

