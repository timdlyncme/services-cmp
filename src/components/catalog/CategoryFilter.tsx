import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Check, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: Record<string, number>;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onClearFilters: () => void;
}

export default function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryToggle,
  onClearFilters
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  
  const categoryList = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));
  const hasFilters = selectedCategories.length > 0;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between min-w-[200px]",
              hasFilters && "border-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>
                {hasFilters 
                  ? `${selectedCategories.length} categories selected`
                  : "Filter by category"
                }
              </span>
            </div>
            {hasFilters && (
              <Badge variant="secondary" className="ml-2">
                {selectedCategories.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {categoryList.map(([category, count]) => (
                  <CommandItem
                    key={category}
                    value={category}
                    onSelect={() => {
                      onCategoryToggle(category);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCategories.includes(category) 
                          ? "opacity-100" 
                          : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <span>{category}</span>
                      <Badge variant="outline" className="ml-2">
                        {count}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 px-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
      
      {hasFilters && (
        <div className="flex flex-wrap gap-1">
          {selectedCategories.map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onCategoryToggle(category)}
            >
              {category}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

