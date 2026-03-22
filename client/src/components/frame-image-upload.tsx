import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FrameImageUploadProps {
  value?: {
    file: File | null;
    url: string | null;
  } | null;
  onChange: (value: { file: File | null; url: string | null } | null) => void;
  label?: string;
  disabled?: boolean;
}

export default function FrameImageUpload({ 
  value, 
  onChange, 
  label,
  disabled = false
}: FrameImageUploadProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCountRef = useRef(0);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: t("toasts.invalidFileType"),
        description: t("toasts.pleaseSelectImageFile"),
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("toasts.fileTooLarge"),
        description: t("toasts.pleaseSelectSmallerImage"),
        variant: "destructive"
      });
      return;
    }

    if (value?.url) {
      URL.revokeObjectURL(value.url);
    }

    const url = URL.createObjectURL(file);
    onChange({ file, url });
  }, [onChange, toast, value, t]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleRemove = useCallback(() => {
    if (value?.url) {
      URL.revokeObjectURL(value.url);
    }
    onChange(null);
  }, [value, onChange]);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasImage = value && value.url;

  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        isDragOver && "ring-2 ring-[hsl(var(--accent-primary))] rounded-lg"
      )}
      onDrop={disabled ? undefined : handleDrop}
      onDragEnter={disabled ? undefined : handleDragEnter}
      onDragOver={disabled ? undefined : handleDragOver}
      onDragLeave={disabled ? undefined : handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
      
      {hasImage ? (
        <div className="relative">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-600 bg-[hsl(var(--dark-elevated))]">
            <img
              src={value.url || ''}
              alt={label || "Frame"}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            type="button"
            className="absolute top-0.5 left-0.5 z-10 w-[14px] h-[14px] p-0 min-w-0 min-h-0 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center leading-none text-[10px]"
            onClick={handleRemove}
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={disabled ? undefined : triggerFileSelect}
          onDrop={disabled ? undefined : handleDrop}
          onDragEnter={disabled ? undefined : handleDragEnter}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
          disabled={disabled}
          className={cn(
            "w-12 h-12 rounded-xl border-2 border-dashed border-gray-600 hover:border-gray-500 flex items-center justify-center transition-colors",
            "bg-[hsl(var(--dark-elevated))] hover:bg-[hsl(var(--dark-elevated))]/80",
            disabled && "opacity-50 cursor-not-allowed",
            isDragOver && "border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/10"
          )}
          title={label || "Add frame image"}
        >
          <ImageIcon className="w-5 h-5 text-gray-400 pointer-events-none" />
        </button>
      )}
    </div>
  );
}
