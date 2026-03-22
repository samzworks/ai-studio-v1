import { useCallback, useState, type ReactNode } from "react";
import { Heart, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import GalleryToolbar, { type GalleryToolbarToggle } from "@/components/gallery-toolbar";
import { useIsMobile } from "@/hooks/use-mobile";

interface FilterBarProps {
  onFilterChange: (filter: string) => void;
  onSearchChange?: (search: string) => void;
  onSortChange: (sort: string) => void;
  onImageSizeChange: (size: number) => void;
  imageCount: number;
  imageSize?: number;
  mobileActionSlot?: ReactNode;
}

export default function FilterBar({
  onFilterChange,
  onSearchChange,
  onSortChange,
  onImageSizeChange,
  imageCount,
  imageSize = 4,
  mobileActionSlot,
}: FilterBarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");

  const executeSearch = useCallback(() => {
    setSearchQuery(searchInput);
    if (onSearchChange) {
      onSearchChange(searchInput);
      return;
    }

    onFilterChange(searchInput);
  }, [searchInput, onSearchChange, onFilterChange]);

  const handleToggleChange = useCallback(
    (nextIds: string[]) => {
      const sanitized = nextIds.filter((id) => id !== "newest");
      setActiveFilters(sanitized);
      onFilterChange(sanitized.join(","));
    },
    [onFilterChange],
  );

  const handleSortChange = useCallback(
    (value: string) => {
      setSortBy(value);
      onSortChange(value);
    },
    [onSortChange],
  );

  const handleClearAll = useCallback(() => {
    setActiveFilters([]);
    setSearchInput("");
    setSearchQuery("");
    setSortBy("newest");
    onFilterChange("");
    onSortChange("newest");
    if (onSearchChange) {
      onSearchChange("");
    }
  }, [onFilterChange, onSearchChange, onSortChange]);

  const toggles: GalleryToolbarToggle[] = [
    { id: "favorites", label: t("filters.favorites"), icon: Heart },
    { id: "scaled", label: t("filters.scaled"), icon: Maximize2 },
  ];

  const sortOptions = [
    { value: "newest", label: t("filters.sortOptions.newest") },
    { value: "oldest", label: t("filters.sortOptions.oldest") },
    { value: "favorites", label: t("filters.sortOptions.favorites") },
    { value: "prompt", label: t("filters.sortOptions.promptAZ") },
    { value: "size", label: t("filters.sortOptions.size") },
  ];

  return (
    <GalleryToolbar
      searchPlaceholder={t("forms.placeholder.searchImages")}
      searchValue={searchQuery}
      searchDraftValue={searchInput}
      onSearchDraftChange={setSearchInput}
      onSearchCommit={executeSearch}
      toggles={toggles}
      activeToggleIds={activeFilters}
      onToggleChange={handleToggleChange}
      sortValue={sortBy}
      sortOptions={sortOptions}
      onSortChange={handleSortChange}
      countLabel={t("pages.gallery.imageCount", { count: imageCount })}
      zoom={{
        value: imageSize,
        min: 1,
        max: isMobile ? 1 : 12,
        onChange: onImageSizeChange,
      }}
      onClearAll={handleClearAll}
      isMobile={isMobile}
      mobileActionSlot={mobileActionSlot}
    />
  );
}
