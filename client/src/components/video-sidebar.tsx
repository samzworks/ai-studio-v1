import VideoGenerationForm from "./video-generation-form";

interface VideoSidebarProps {
  onVideoGenerated: (video: any) => void;
  onMobileClose?: () => void;
}

export default function VideoSidebar({ onVideoGenerated, onMobileClose }: VideoSidebarProps) {
  return (
    <aside className="w-full md:w-[22rem] bg-sidebar-primary-foreground/5 dark:bg-sidebar-background border-r border-sidebar-border flex flex-col h-full backdrop-blur-xl">
      {/* Generation Controls */}
      <div className="mobile-padding pb-24 md:pb-16 space-y-4 md:space-y-6 overflow-y-auto mobile-scroll">
        <VideoGenerationForm onVideoGenerated={onVideoGenerated} onMobileClose={onMobileClose} />
      </div>
    </aside>
  );
}
