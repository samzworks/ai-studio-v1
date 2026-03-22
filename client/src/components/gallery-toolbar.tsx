import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  SlidersHorizontal as Filter,
  ChevronDown,
  Check,
  Plus,
  Minus,
  X,
  ArrowUpWideNarrow as SortAsc,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface GalleryToolbarToggle {
  id: string;
  label: string;
  icon?: LucideIcon;
  hidden?: boolean;
}

export interface GalleryToolbarSelect {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface GalleryToolbarProps {
  searchPlaceholder: string;
  searchValue: string;
  searchDraftValue: string;
  onSearchDraftChange: (value: string) => void;
  onSearchCommit: () => void;
  toggles: GalleryToolbarToggle[];
  activeToggleIds: string[];
  onToggleChange: (nextIds: string[]) => void;
  sortValue: string;
  sortOptions: { value: string; label: string }[];
  onSortChange: (value: string) => void;
  extraSelects?: GalleryToolbarSelect[];
  onExtraSelectChange?: (id: string, value: string) => void;
  countLabel?: string;
  zoom?: { value: number; min: number; max: number; onChange: (value: number) => void };
  onClearAll: () => void;
  isMobile: boolean;
  mobileActionSlot?: ReactNode;
}

export default function GalleryToolbar({
  searchPlaceholder,
  searchValue,
  searchDraftValue,
  onSearchDraftChange,
  onSearchCommit,
  toggles,
  activeToggleIds,
  onToggleChange,
  sortValue,
  sortOptions,
  onSortChange,
  extraSelects = [],
  onExtraSelectChange,
  countLabel,
  zoom,
  onClearAll,
  isMobile,
  mobileActionSlot,
}: GalleryToolbarProps) {
  const { t } = useTranslation();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsSearchExpanded(false);
    }
  }, [isMobile]);

  // Guard against stale state from the old UI where "newest" was a toggle.
  useEffect(() => {
    if (!activeToggleIds.includes("newest")) {
      return;
    }

    const sanitized = activeToggleIds.filter((id) => id !== "newest");
    onToggleChange(sanitized);
    if (!sortValue) {
      onSortChange("newest");
    }
  }, [activeToggleIds, onToggleChange, sortValue, onSortChange]);

  const visibleToggles = useMemo(
    () => toggles.filter((toggle) => !toggle.hidden && toggle.id !== "newest"),
    [toggles],
  );

  const toggleFilter = (filterId: string) => {
    const base = activeToggleIds.filter((id) => id !== "newest");
    const next = base.includes(filterId)
      ? base.filter((id) => id !== filterId)
      : [...base, filterId];
    onToggleChange(next);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchCommit();
    }
  };

  const hasActiveState =
    !!searchValue.trim() ||
    !!searchDraftValue.trim() ||
    activeToggleIds.filter((id) => id !== "newest").length > 0 ||
    extraSelects.some((select) => select.value !== select.options[0]?.value) ||
    sortValue !== "newest";

  const selectedSortLabel =
    sortOptions.find((option) => option.value === sortValue)?.label ||
    sortOptions[0]?.label ||
    t("filters.sortOptions.newest");

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="hidden lg:flex items-center gap-2 flex-nowrap">
        <div className="relative flex-1 min-w-[18rem]">
          <Search
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-[#21B0F8]"
            onClick={onSearchCommit}
          />
          <Input
            placeholder={searchPlaceholder}
            value={searchDraftValue}
            onChange={(e) => onSearchDraftChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pr-11 bg-[hsl(var(--card))] border-input text-foreground placeholder:text-muted-foreground focus:border-primary/50 min-h-[44px]"
            data-testid="input-search"
          />
        </div>

        {visibleToggles.map((toggle) => {
          const Icon = toggle.icon;
          const isActive = activeToggleIds.includes(toggle.id);

          return (
            <Button
              key={toggle.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter(toggle.id)}
              className={`${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : "bg-secondary/50 border-input text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/50"
              } min-h-[44px] px-3 whitespace-nowrap`}
              data-testid={`button-filter-${toggle.id}`}
              aria-label={toggle.label}
            >
              {Icon ? <Icon className="h-4 w-4 mr-1.5" /> : null}
              <span>{toggle.label}</span>
            </Button>
          );
        })}

        {extraSelects.map((selectCfg) => (
          <Select
            key={selectCfg.id}
            value={selectCfg.value}
            onValueChange={(value) => onExtraSelectChange?.(selectCfg.id, value)}
          >
            <SelectTrigger
              className="w-36 min-h-[44px] bg-[hsl(var(--card))] border-input text-foreground"
              data-testid={`select-${selectCfg.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              {selectCfg.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {countLabel ? (
          <span className="hidden xl:block text-sm text-muted-foreground whitespace-nowrap">
            {countLabel}
          </span>
        ) : null}

        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-36 min-h-[44px] bg-[hsl(var(--card))] border-input text-foreground" data-testid="select-sort">
            <SortAsc className="h-4 w-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {zoom ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoom.onChange(Math.max(zoom.min, zoom.value - 1))}
              disabled={zoom.value <= zoom.min}
              className="bg-secondary/50 border-input text-muted-foreground hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px] p-0"
              aria-label={t("common.zoomOut")}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[2ch] text-center">{zoom.value}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => zoom.onChange(Math.min(zoom.max, zoom.value + 1))}
              disabled={zoom.value >= zoom.max}
              className="bg-secondary/50 border-input text-muted-foreground hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px] p-0"
              aria-label={t("common.zoomIn")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {hasActiveState ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-foreground min-h-[44px] px-3"
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4 mr-1.5" />
            <span>{t("common.clear")}</span>
          </Button>
        ) : null}
      </div>

      <div className="lg:hidden space-y-2">
        {isSearchExpanded ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-[#21B0F8]"
                onClick={onSearchCommit}
              />
              <Input
                placeholder={searchPlaceholder}
                value={searchDraftValue}
                onChange={(e) => onSearchDraftChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                className="pr-11 bg-[hsl(var(--card))] border-input text-foreground placeholder:text-muted-foreground min-h-[44px]"
                data-testid="input-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsSearchExpanded(false);
                onSearchDraftChange("");
              }}
              className="bg-[hsl(var(--card))] border-input text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))] min-h-[44px] min-w-[44px] p-0"
              data-testid="button-search-close"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${mobileActionSlot ? "justify-start" : "justify-between"}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[hsl(var(--card))] border-input text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))] min-h-[44px] gap-1.5 px-3 shrink-0"
                  data-testid="button-filter-menu"
                >
                  <Filter className="h-4 w-4" />
                  <span className="text-xs font-medium">{selectedSortLabel}</span>
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border text-popover-foreground w-64">
                {visibleToggles.length > 0 ? (
                  <>
                    <DropdownMenuLabel>{t("common.filter")}</DropdownMenuLabel>
                    {visibleToggles.map((toggle) => {
                      const Icon = toggle.icon;
                      const isActive = activeToggleIds.includes(toggle.id);

                      return (
                        <DropdownMenuItem key={toggle.id} onClick={() => toggleFilter(toggle.id)}>
                          {Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
                          <span className="flex-1">{toggle.label}</span>
                          {isActive ? <Check className="h-4 w-4" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                  </>
                ) : null}

                <DropdownMenuLabel>{t("filters.sortLabel")}</DropdownMenuLabel>
                {sortOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => onSortChange(option.value)}>
                    <span className="flex-1">{option.label}</span>
                    {sortValue === option.value ? <Check className="h-4 w-4" /> : null}
                  </DropdownMenuItem>
                ))}

                {extraSelects.map((selectCfg) => (
                  <div key={selectCfg.id}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{selectCfg.label}</DropdownMenuLabel>
                    {selectCfg.options.map((option) => (
                      <DropdownMenuItem
                        key={`${selectCfg.id}-${option.value}`}
                        onClick={() => onExtraSelectChange?.(selectCfg.id, option.value)}
                      >
                        <span className="flex-1">{option.label}</span>
                        {selectCfg.value === option.value ? <Check className="h-4 w-4" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}

                {hasActiveState ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onClearAll} className="text-muted-foreground">
                      <X className="h-4 w-4 mr-2" />
                      {t("common.clearAllFilters")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            {countLabel ? (
              <span className={`text-xs text-muted-foreground truncate min-w-0 ${mobileActionSlot ? "flex-1 text-center" : ""}`}>
                {countLabel}
              </span>
            ) : (
              <span className={mobileActionSlot ? "flex-1" : ""} />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSearchExpanded(true)}
              className="bg-[hsl(var(--card))] border-input text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))] min-h-[44px] min-w-[44px] p-2.5 shrink-0"
              data-testid="button-search-expand"
              aria-label={t("common.search")}
            >
              <Search className="h-4 w-4" />
            </Button>

            {mobileActionSlot ? <div className="shrink-0">{mobileActionSlot}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
