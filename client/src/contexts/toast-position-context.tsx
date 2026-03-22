import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastPosition = "top" | "bottom";

interface ToastPositionContextType {
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
  setGenerationFormActive: (active: boolean) => void;
  isGenerationFormActive: boolean;
}

const ToastPositionContext = createContext<ToastPositionContextType | undefined>(undefined);

export function ToastPositionProvider({ children }: { children: ReactNode }) {
  const [isGenerationFormActive, setIsGenerationFormActive] = useState(false);
  
  const position: ToastPosition = isGenerationFormActive ? "bottom" : "top";

  const setGenerationFormActive = useCallback((active: boolean) => {
    setIsGenerationFormActive(active);
  }, []);

  const setPosition = useCallback(() => {
  }, []);

  return (
    <ToastPositionContext.Provider value={{ position, setPosition, setGenerationFormActive, isGenerationFormActive }}>
      {children}
    </ToastPositionContext.Provider>
  );
}

export function useToastPosition() {
  const context = useContext(ToastPositionContext);
  if (context === undefined) {
    return { position: "top" as ToastPosition, setPosition: () => {}, setGenerationFormActive: () => {}, isGenerationFormActive: false };
  }
  return context;
}
