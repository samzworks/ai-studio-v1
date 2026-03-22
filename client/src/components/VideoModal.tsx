import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface VideoModalProps {
  video: {
    id: number;
    url: string | null;
    prompt: string;
    model: string;
    width: number;
    height: number;
    duration?: number;
    thumbnailUrl?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ video, isOpen, onClose }: VideoModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !video || !video.url) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative bg-gray-900 rounded-xl overflow-hidden max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
        >
          <span className="text-2xl">×</span>
        </Button>
        
        {/* Video Player Container */}
        <div className="bg-black flex items-center justify-center">
          <video
            src={video.url}
            controls
            autoPlay
            loop
            className="max-w-[90vw] max-h-[80vh]"
            poster={video.thumbnailUrl || undefined}
            style={{
              aspectRatio: `${video.width} / ${video.height}`
            }}
          />
        </div>
      </div>
    </div>
  );
}