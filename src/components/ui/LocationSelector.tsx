import { useState, useEffect } from 'react';
import { LOCATION_GROUPS, getGroupByLocation, type LocationGroup } from '@/config/locations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, X, MapPin } from 'lucide-react';

interface LocationSelectorProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  disabled?: boolean;
}

const LocationSelector = ({
  value,
  onChange,
  placeholder = 'Select area',
  showAllOption = false,
  allOptionLabel = 'All Areas',
  className = '',
  disabled = false,
}: LocationSelectorProps) => {
  const [selectedGroup, setSelectedGroup] = useState<LocationGroup | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value && value !== 'All') {
      const group = getGroupByLocation(value);
      if (group) {
        setSelectedGroup(group);
      }
    }
  }, [value]);

  const handleGroupSelect = (groupId: string) => {
    const group = LOCATION_GROUPS.find(g => g.id === groupId);
    setSelectedGroup(group || null);
  };

  const handleLocationSelect = (location: string) => {
    onChange(location);
    setIsOpen(false);
  };

  const handleBack = () => {
    setSelectedGroup(null);
  };

  const handleClear = () => {
    onChange(showAllOption ? 'All' : '');
    setSelectedGroup(null);
  };

  const handleAllSelect = () => {
    onChange('All');
    setIsOpen(false);
  };

  const getDisplayValue = () => {
    if (!value || value === 'All') {
      return showAllOption ? allOptionLabel : placeholder;
    }
    return value;
  };

  const currentGroup = value && value !== 'All' ? getGroupByLocation(value) : null;

  return (
    <div className={`relative ${className}`}>
      <Select
        open={isOpen}
        onOpenChange={setIsOpen}
        value={value}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{getDisplayValue()}</span>
            {currentGroup && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex shrink-0">
                {currentGroup.name.split(' ')[0]}
              </Badge>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="bg-background border border-border min-w-[280px] max-h-[300px]">
          {!selectedGroup ? (
            <div className="py-1">
              {showAllOption && (
                <div
                  onClick={handleAllSelect}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm transition-colors"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{allOptionLabel}</span>
                </div>
              )}
              {showAllOption && <div className="h-px bg-border my-1" />}
              <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Select Zone</p>
              {LOCATION_GROUPS.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleGroupSelect(group.id)}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent rounded-sm transition-colors"
                >
                  <span className="text-sm">{group.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {group.locations.length}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-1">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBack();
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {selectedGroup.name}
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {selectedGroup.locations.map((location) => (
                  <div
                    key={location}
                    onClick={() => handleLocationSelect(location)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm transition-colors ${
                      value === location ? 'bg-accent' : ''
                    }`}
                  >
                    <span className="text-sm">{location}</span>
                    {value === location && (
                      <Badge className="text-[10px] px-1.5 py-0 ml-auto">Selected</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SelectContent>
      </Select>
      
      {value && value !== 'All' && !showAllOption && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

export default LocationSelector;
