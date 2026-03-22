import ParallelGenerationForm from "./parallel-generation-form";

interface SidebarProps {
  onImageGenerated: () => void;
  onJobsUpdate?: (activeJobCount: number) => void;
  onMobileClose?: () => void;
  initialModel?: string;
}

export default function Sidebar({ onImageGenerated, onJobsUpdate, onMobileClose, initialModel }: SidebarProps) {

  return (
    <aside className="w-full md:w-[22rem] bg-sidebar-primary-foreground/5 dark:bg-sidebar-background border-r border-sidebar-border flex flex-col h-full backdrop-blur-xl">
      {/* Generation Controls */}
      <div className="mobile-padding pb-24 md:pb-16 space-y-4 md:space-y-6 overflow-y-auto mobile-scroll">
        <ParallelGenerationForm
          onImageGenerated={onImageGenerated}
          selectedPrompt=""
          onJobsChange={onJobsUpdate || (() => { })}
          onMobileClose={onMobileClose}
          initialModel={initialModel}
        />
      </div>
    </aside>
  );
}
