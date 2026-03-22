import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StyleImageUploadProps {
  value?: {
    file: File | null;
    url: string | null;
    strength: number;
  }[] | null;
  onChange: (value: { file: File | null; url: string | null; strength: number }[] | null) => void;
  supportedModelName?: string;
  disabled?: boolean;
  supportsImage?: boolean;
  maxFiles?: number;
}

export default function StyleImageUpload({ 
  value, 
  onChange, 
  supportedModelName = "Flux Ultra",
  disabled = false,
  maxFiles = 10
}: StyleImageUploadProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback((files: File[]) => {
    const currentFiles = value || [];
    const validFiles: { file: File; url: string; strength: number }[] = [];

    for (const file of files) {
      if (currentFiles.length + validFiles.length >= maxFiles) {
        toast({
          title: t("toasts.maxFilesReached"),
          description: `Maximum ${maxFiles} files allowed`,
          variant: "destructive"
        });
        break;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: t("toasts.invalidFileType"),
          description: t("toasts.pleaseSelectImageFile"),
          variant: "destructive"
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t("toasts.fileTooLarge"),
          description: t("toasts.pleaseSelectSmallerImage"),
          variant: "destructive"
        });
        continue;
      }

      const url = URL.createObjectURL(file);
      validFiles.push({
        file,
        url,
        strength: 0.5
      });
    }

    if (validFiles.length > 0) {
      onChange([...currentFiles, ...validFiles]);
    }
  }, [onChange, toast, value, maxFiles, t]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const dragCountRef = useRef(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
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

  const handleRemove = useCallback((index: number) => {
    if (!value) return;
    
    const fileToRemove = value[index];
    if (fileToRemove?.url) {
      URL.revokeObjectURL(fileToRemove.url);
    }
    
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles.length > 0 ? newFiles : null);
  }, [value, onChange]);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasImages = value && value.length > 0;
  const canAddMore = !hasImages || value.length < maxFiles;

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
        multiple
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
      
      {hasImages && (
        <div className="flex items-center gap-1.5">
          {value.map((item, index) => (
            <div key={index} className="relative">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-600 bg-[hsl(var(--dark-elevated))]">
                <img
                  src={item.url || ''}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                className="absolute top-0.5 left-0.5 z-10 w-[14px] h-[14px] p-0 min-w-0 min-h-0 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center leading-none text-[10px]"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {canAddMore && (
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
          title={hasImages ? `Add more images (${value.length}/${maxFiles})` : "Add reference images"}
        >
          {hasImages ? (
            <Plus className="w-5 h-5 text-gray-400 pointer-events-none" />
          ) : (
            <ImageIcon className="w-5 h-5 text-gray-400 pointer-events-none" />
          )}
        </button>
      )}
    </div>
  );
}
