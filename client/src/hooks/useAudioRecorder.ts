import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onTranscript?: (text: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
  error: string | null;
  autoStopped: boolean;
}

const SILENCE_THRESHOLD = 0.01; // Audio level threshold for silence detection
const SILENCE_DURATION = 3000; // 3 seconds of silence triggers auto-stop
const MAX_DURATION = 120000; // 120 seconds max recording duration
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB max file size

export function useAudioRecorder({ onTranscript }: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep onTranscript ref updated
  onTranscriptRef.current = onTranscript;

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/stt/fal-turbo-single', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      const transcript = data.text || '';
      
      // Call the onTranscript callback if provided
      if (onTranscriptRef.current) {
        onTranscriptRef.current(transcript);
      }
      
      return transcript;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const stopRecordingAndTranscribe = useCallback(async (isAutoStop = false) => {
    // Stop the MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);

    if (isAutoStop) {
      setAutoStopped(true);
      // Reset auto-stopped flag after a delay
      setTimeout(() => setAutoStopped(false), 3000);
    }

    // Wait for the MediaRecorder to finalize the blob
    await new Promise(resolve => setTimeout(resolve, 100));

    const blob = audioChunksRef.current.length > 0 
      ? new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
      : null;

    if (!blob) {
      const error = 'No audio recorded';
      setError(error);
      throw new Error(error);
    }

    if (blob.size > MAX_FILE_SIZE) {
      const error = `Recording too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Maximum is 30MB.`;
      setError(error);
      throw new Error(error);
    }

    // Transcribe the audio
    await transcribeAudio(blob);
  }, [cleanup, transcribeAudio]);

  const checkSilence = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedVolume = average / 255;

    if (normalizedVolume < SILENCE_THRESHOLD) {
      // Start silence timer if not already started
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('Auto-stopping due to 5s silence');
          stopRecordingAndTranscribe(true).catch(console.error);
        }, SILENCE_DURATION);
      }
    } else {
      // Reset silence timer if sound detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  }, [stopRecordingAndTranscribe]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAutoStopped(false);
      audioChunksRef.current = [];
      setRecordingTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context for silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Start MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start recording time counter
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start silence detection check (check every 100ms)
      silenceCheckIntervalRef.current = setInterval(checkSilence, 100);

      // Set max duration timer (120 seconds)
      maxDurationTimerRef.current = setTimeout(() => {
        console.log('Auto-stopping due to max duration (120s)');
        stopRecordingAndTranscribe(true).catch(console.error);
      }, MAX_DURATION);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone. Please check permissions.');
      cleanup();
    }
  }, [checkSilence, cleanup, stopRecordingAndTranscribe]);

  const stopAndTranscribe = useCallback(async (): Promise<void> => {
    await stopRecordingAndTranscribe(false);
  }, [stopRecordingAndTranscribe]);

  return {
    isRecording,
    recordingTime,
    isTranscribing,
    startRecording,
    stopAndTranscribe,
    error,
    autoStopped,
  };
}
