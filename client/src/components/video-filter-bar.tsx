import { useCallback, useState, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

import GalleryToolbar, { type GalleryToolbarToggle } from "@/components/gallery-toolbar";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoFilterBarProps {
  onFilterChange: (filters: string) => void;
  onSearchChange?: (query: string) => void;
  onSortChange: (sort: string) => void;
  onVideoSizeChange: (size: number) => void;
  videoCount: number;
  videoSize?: number;
  mobileActionSlot?: ReactNode;
}

export default function VideoFilterBar({
  onFilterChange,
  onSearchChange,
  onSortChange,
  onVideoSizeChange,
  videoCount,
  videoSize = 4,
  mobileActionSlot,
}: VideoFilterBarProps) {
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
  ];

  const sortOptions = [
    { value: "newest", label: t("filters.sortOptions.newest") },
    { value: "oldest", label: t("filters.sortOptions.oldest") },
    { value: "prompt", label: t("filters.sortOptions.promptAZ") },
  ];

  return (
    <GalleryToolbar
      searchPlaceholder={t("forms.placeholder.searchVideos")}
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
      countLabel={t("pages.videoStudio.videoCount", { count: videoCount })}
      zoom={{
        value: videoSize,
        min: 1,
        max: 12,
        onChange: onVideoSizeChange,
      }}
      onClearAll={handleClearAll}
      isMobile={isMobile}
      mobileActionSlot={mobileActionSlot}
    />
  );
}
