import React, { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ImageUploadValue {
  file: File | null;
  url: string | null;
}

interface ImageUploadProps {
  value: ImageUploadValue | null;
  onChange: (value: ImageUploadValue | null) => void;
  label: string;
  disabled?: boolean;
  accept?: string;
}

export default function ImageUpload({ value, onChange, label, disabled = false, accept = "image/*" }: ImageUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const isVideoMode = accept.includes('video');

  const handleFileSelect = useCallback((file: File) => {
    const isValidType = isVideoMode ? 
      file.type.startsWith('video/') || file.type.startsWith('image/') : 
      file.type.startsWith('image/');
    
    if (isValidType) {
      const url = URL.createObjectURL(file);
      onChange({ file, url });
    }
  }, [onChange, isVideoMode]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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

  return (
    <div className="space-y-3">
      {!value ? (
        // Upload area
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all",
            "bg-[hsl(var(--dark-elevated))] border-gray-700 hover:border-[hsl(var(--accent-primary))]",
            isDragOver && "border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDrop={disabled ? undefined : handleDrop}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
          onClick={disabled ? undefined : triggerFileSelect}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />
          
          <div className="flex items-center justify-center gap-2">
            <Upload className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              {t('forms.imageUpload.dropHere')} <span className="text-[#21B0F8] font-medium">{isVideoMode ? t('forms.labels.uploadVideo') : t('forms.imageUpload.uploadImage')}</span>
            </span>
          </div>
        </div>
      ) : (
        // Preview with controls
        <div className="flex items-center gap-3">
          {/* Preview (image or video) */}
          <div className="relative group flex-shrink-0">
            <div className="w-12 h-12 rounded-md overflow-hidden border border-gray-700">
              {value.file?.type?.startsWith('video/') ? (
                <video
                  src={value.url || ''}
                  className="w-full h-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={value.url || ''}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="absolute -top-1 -right-1 w-4 h-4 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X className="w-2 h-2" />
            </Button>
          </div>

          {/* File info */}
          <div className="flex-1">
            <div className="text-sm text-gray-300">
              {value.file?.name || (value.file?.type?.startsWith('video/') ? 'Uploaded video' : t('forms.imageUpload.uploadedImage'))}
            </div>
            <div className="text-xs text-gray-500">
              {value.file?.size ? `${(value.file.size / 1024 / 1024).toFixed(1)} MB` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}