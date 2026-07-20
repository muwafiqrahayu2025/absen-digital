import { create } from 'zustand';

interface GlobalState {
  isOfflineMode: boolean;
  setOfflineMode: (offline: boolean) => void;
  faceRecognitionEnabled: boolean;
  setFaceRecognition: (enabled: boolean) => void;
  waFallbackModalOpen: boolean;
  setWaFallbackModalOpen: (open: boolean) => void;
  waFallbackMessage: string;
  setWaFallbackMessage: (msg: string) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  isOfflineMode: !navigator.onLine,
  setOfflineMode: (offline) => set({ isOfflineMode: offline }),
  faceRecognitionEnabled: true,
  setFaceRecognition: (enabled) => set({ faceRecognitionEnabled: enabled }),
  waFallbackModalOpen: false,
  setWaFallbackModalOpen: (open) => set({ waFallbackModalOpen: open }),
  waFallbackMessage: "",
  setWaFallbackMessage: (msg) => set({ waFallbackMessage: msg }),
}));
