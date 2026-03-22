import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shuffle, Mic, Square, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PromptInputSectionProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onRandomPrompt: () => void;
  isGenerating?: boolean;
  enhanceToggle?: React.ReactNode;
  variant?: "default" | "glass";
  showLabel?: boolean;
}

const PromptInputSection = React.memo(({
  prompt,
  onPromptChange,
  onRandomPrompt,
  isGenerating = false,
  enhanceToggle,
  variant = "default",
  showLabel = true,
}: PromptInputSectionProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isGlass = variant === "glass";

  const promptRef = React.useRef(prompt);

  React.useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(e.target.value);
  }, [onPromptChange]);

  const handleTranscript = useCallback((text: string) => {
    if (text) {
      const currentPrompt = promptRef.current;
      onPromptChange(currentPrompt ? `${currentPrompt} ${text}` : text);

      toast({
        description: t("toasts.voiceInputEnded"),
        duration: 2000
      });
    }
  }, [onPromptChange, toast, t]);

  const {
    isRecording,
    recordingTime,
    isTranscribing,
    startRecording,
    stopAndTranscribe,
    error: recorderError,
    autoStopped
  } = useAudioRecorder({ onTranscript: handleTranscript });

  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      // Stop recording and transcribe
      try {
        await stopAndTranscribe();
      } catch (err) {
        console.error('Transcription failed:', err);
        // Error is already set in the hook, will be shown below
      }
    } else {
      // Start recording
      try {
        await startRecording();
      } catch (err) {
        console.error('Failed to start recording:', err);
      }
    }
  }, [isRecording, stopAndTranscribe, startRecording]);

  // Show error toasts
  React.useEffect(() => {
    if (recorderError) {
      toast({
        title: t("toasts.voiceInputError"),
        description: recorderError,
        variant: "destructive"
      });
    }
  }, [recorderError, toast, t]);

  // Show auto-stop notification
  React.useEffect(() => {
    if (autoStopped && !isRecording) {
      toast({
        description: t("toasts.voiceInputEnded"),
        duration: 3000
      });
    }
  }, [autoStopped, isRecording, toast, t]);

  // Format recording time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", isGlass && "space-y-3")}>
        {showLabel && (
          <Label
            htmlFor="prompt"
            className={cn(isGlass && "text-base font-semibold text-white/95 tracking-tight")}
          >
            {t('forms.labels.prompt')}
          </Label>
        )}

        <div className="relative">
          <Textarea
            id="prompt"
            value={prompt}
            onChange={handlePromptChange}
            placeholder={t('forms.placeholder.prompt')}
            className={cn(
              "resize-y",
              isGlass
                ? "min-h-[170px] rounded-[10px] border border-white/20 bg-white/[0.07] px-4 py-4 text-[15px] text-white shadow-inner shadow-black/10 backdrop-blur-md placeholder:text-white/55 focus-visible:ring-[#5fb6ff] focus-visible:ring-offset-0"
                : "min-h-[100px]"
            )}
            maxLength={10000}
            data-testid="textarea-prompt"
          />
        </div>

        {isGlass && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {enhanceToggle}
              {(isRecording || isTranscribing) && (
                <div className="flex items-center gap-2 text-xs text-white/75">
                  {isRecording && (
                    <span className="text-red-300 font-medium" data-testid="text-recording-time">
                      {formatTime(recordingTime)}
                    </span>
                  )}
                  {isTranscribing && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
                      <span data-testid="text-transcribing">Transcribing...</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRandomPrompt}
                    className="h-8 w-8 rounded-[10px] p-0 text-white/80 hover:bg-white/10 hover:text-white"
                    data-testid="button-random-prompt"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate random prompt</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleMicClick}
                    disabled={isTranscribing}
                    className={cn(
                      "h-8 w-8 rounded-[10px] p-0 hover:bg-white/10",
                      isRecording ? "text-red-300 hover:text-red-200" : "text-white/85 hover:text-white"
                    )}
                    data-testid="button-voice-input"
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-4 w-4 relative z-10 fill-current" />
                        <span className="absolute inset-0 rounded-full animate-mic-pulse bg-red-500/30" />
                      </>
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? 'Stop & transcribe' : 'Voice input (auto language detection)'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {!isGlass && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {enhanceToggle}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRandomPrompt}
                  className="text-muted-foreground hover:text-foreground hover:bg-accent p-2"
                  data-testid="button-random-prompt"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Generate random prompt</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2">
              {(isRecording || isTranscribing) && (
                <div className="flex items-center gap-2 text-sm">
                  {isRecording && (
                    <>
                      <span className="text-red-500 font-medium" data-testid="text-recording-time">
                        {formatTime(recordingTime)}
                      </span>
                      <span className="text-gray-400 text-xs">
                        (Auto-stops: 3s silence or 2:00)
                      </span>
                    </>
                  )}
                  {isTranscribing && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-blue-400" data-testid="text-transcribing">Transcribing...</span>
                    </div>
                  )}
                </div>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleMicClick}
                    disabled={isTranscribing}
                    className={`p-2 relative ${isRecording
                      ? 'text-red-500 hover:text-red-400'
                      : 'text-muted-foreground hover:text-foreground'
                      } hover:bg-accent`}
                    data-testid="button-voice-input"
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-4 h-4 relative z-10 fill-current" />
                        <span className="absolute inset-0 rounded-md animate-mic-pulse bg-red-500/30" />
                      </>
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? 'Stop & transcribe' : 'Voice input (auto language detection)'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

PromptInputSection.displayName = 'PromptInputSection';

export default PromptInputSection;
