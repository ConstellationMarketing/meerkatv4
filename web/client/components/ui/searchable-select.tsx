import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchableSelectProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export const SearchableSelect = React.forwardRef<
  HTMLDivElement,
  SearchableSelectProps
>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Search...",
      className,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);

    const filteredOptions = React.useMemo(() => {
      if (!searchTerm) return options;
      return options.filter((option) =>
        option.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }, [searchTerm, options]);

    const handleSelect = (option: string) => {
      onChange(option);
      setSearchTerm("");
      setIsOpen(false);
    };

    const handleClear = () => {
      onChange("");
      setSearchTerm("");
    };

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn("relative w-full", className)}
        {...props}
      >
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder}
            value={isOpen ? searchTerm : value || ""}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="pr-10"
          />
          {value && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-input rounded-md bg-background shadow-md max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <ul className="py-1">
                {filteredOptions.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                        value === option &&
                          "bg-primary/10 text-primary font-medium",
                      )}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No clients found
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";
