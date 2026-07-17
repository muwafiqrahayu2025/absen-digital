import { create } from 'zustand';

interface GlobalState {
  isOfflineMode: boolean;
  setOfflineMode: (offline: boolean) => void;
  faceRecognitionEnabled: boolean;
  setFaceRecognition: (enabled: boolean) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  isOfflineMode: !navigator.onLine,
  setOfflineMode: (offline) => set({ isOfflineMode: offline }),
  faceRecognitionEnabled: true,
  setFaceRecognition: (enabled) => set({ faceRecognitionEnabled: enabled }),
}));
