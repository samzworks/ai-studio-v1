import { Skeleton } from "@/components/ui/skeleton";
import Masonry from 'react-masonry-css';

interface GallerySkeletonProps {
  count?: number;
}

const SKELETON_ASPECT_RATIOS = [
  "4/3", "3/4", "1/1", "16/9", "9/16", "4/5", "5/4"
];

function SkeletonCard({ aspectRatio }: { aspectRatio: string }) {
  return (
    <div className="relative bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/50">
      <div 
        className="w-full relative"
        style={{ aspectRatio }}
      >
        <Skeleton className="w-full h-full bg-gray-700/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/30 to-transparent skeleton-shimmer" />
      </div>
      <div className="absolute top-3 right-3 flex gap-1.5">
        <Skeleton className="w-6 h-6 rounded-full bg-gray-600/50" />
        <Skeleton className="w-6 h-6 rounded-full bg-gray-600/50" />
      </div>
    </div>
  );
}

const breakpointColumnsObj = {
  default: 4,
  1280: 3,
  1024: 2,
  640: 1,
};

export function GallerySkeleton({ count = 12 }: GallerySkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard 
          key={index} 
          aspectRatio={SKELETON_ASPECT_RATIOS[index % SKELETON_ASPECT_RATIOS.length]} 
        />
      ))}
    </div>
  );
}

export function MasonryGallerySkeleton({ count = 12 }: GallerySkeletonProps) {
  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="flex -ml-6 w-auto"
      columnClassName="pl-6 bg-clip-padding"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="mb-6">
          <SkeletonCard 
            aspectRatio={SKELETON_ASPECT_RATIOS[index % SKELETON_ASPECT_RATIOS.length]}
          />
        </div>
      ))}
    </Masonry>
  );
}

export function InlineLoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-500 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-sm">Loading more...</span>
      </div>
    </div>
  );
}
