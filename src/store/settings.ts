import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emit } from '@tauri-apps/api/event';

export interface AppearanceSettings {
  // Font settings
  fontSize: number; // base size in px
  textColor: string;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  textShadow: boolean;
  
  // Card settings
  cardTransparent: boolean;
  cardColor: string;
  cardOpacity: number; // 0.0 to 1.0
  cardSize: 'small' | 'medium' | 'large';
  autoCardSize: boolean; // automatically choose size based on content
  
  // Color rotation
  colorRotation: boolean;
  
  // Theme
  darkMode: boolean;
  
  // Language symbol
  syncSymbolColor: boolean;
  
  // Multi-space settings (macOS)
  showOnAllSpaces: boolean;
  
  // Position settings
  positionGrid: number; // index for grid positions based on screen size
  randomPosition: boolean;
  manualPosition: boolean;
  manualX: number; // stored manual position
  manualY: number;
  
  // Grid override settings
  autoDetectGrid: boolean;
  manualGridInputType: 'grid' | 'screen';
  manualGridCols: number;
  manualGridRows: number;
  
  // Manual screen size override
  manualScreenWidth: number;
  manualScreenHeight: number;
  
  // Monitor settings
  preferredMonitor: 'auto' | 'primary' | 'current' | number; // auto, primary, current, or monitor index
  allowCrossMonitorPositioning: boolean; // allow settings window on different monitor
  
  // Topic settings (flexible for languages, subjects, etc.)
  selectedTopic: string;
  selectedTopicCode: string;
  selectedTopicIcon: string;
  favoriteTopics: string[]; // Array of favorite topic codes
  
  // Content type settings
  selectedContentType: string;
  selectedContentTypeCode: string;
  selectedContentTypeIcon: string;
  favoriteContentTypes: string[]; // Array of favorite content type codes
}

interface SettingsStore {
  appearance: AppearanceSettings;
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
  syncFromStorage: () => void;
  syncFromEvent: (settings: AppearanceSettings) => void;
}

const defaultAppearance: AppearanceSettings = {
  fontSize: 40,
  textColor: '#FFD700',
  fontFamily: 'system-ui',
  fontWeight: 'bold',
  textShadow: true,
  cardTransparent: true,
  cardColor: 'rgba(255, 255, 255, 0.1)',
  cardOpacity: 0.1,
  cardSize: 'medium',
  autoCardSize: true,
  colorRotation: true,
  darkMode: false,
  syncSymbolColor: false,
  showOnAllSpaces: true,
  positionGrid: 4, // center-left position
  randomPosition: false,
  manualPosition: false,
  manualX: 100,
  manualY: 100,
  autoDetectGrid: true,
  manualGridInputType: 'grid',
  manualGridCols: 4,
  manualGridRows: 3,
  manualScreenWidth: 1920,
  manualScreenHeight: 1080,
  preferredMonitor: 'auto',
  allowCrossMonitorPositioning: true,
  selectedTopic: 'French',
  selectedTopicCode: 'FR',
  selectedTopicIcon: '🇫🇷',
  favoriteTopics: ['EN', 'FR', 'ES', 'DE'], // Default favorites
  selectedContentType: 'Words',
  selectedContentTypeCode: 'WORDS',
  selectedContentTypeIcon: '🔤',
  favoriteContentTypes: ['WORDS', 'SENTENCES', 'EXPRESSIONS', 'PHRASAL_VERBS'], // Default favorite content types
};

console.log('Default appearance settings:', defaultAppearance);

// Debounce function to prevent rapid updates
let debounceTimeout: number | undefined;

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      appearance: defaultAppearance,
      updateAppearance: async (newSettings) => {
        const updatedAppearance = { ...get().appearance, ...newSettings };
        set(() => ({ appearance: updatedAppearance }));
        
        // Debounce the event emission to prevent rapid fire
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
          try {
            await emit('settings-updated', updatedAppearance);
          } catch (error) {
            console.warn('Event emit failed, relying on storage sync:', error);
          }
        }, 100); // 100ms debounce
      },
      syncFromStorage: () => {
        try {
          const raw = localStorage.getItem('floatlearn-settings');
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (parsed?.state?.appearance) {
            const currentAppearance = get().appearance;
            // Simple shallow comparison to prevent unnecessary updates
            const hasChanged = Object.keys(parsed.state.appearance).some(key => 
              currentAppearance[key as keyof AppearanceSettings] !== parsed.state.appearance[key]
            );
            if (hasChanged) {
              set(() => ({ appearance: { ...parsed.state.appearance } }), false); // false = no persist
            }
          }
        } catch (e) {
          console.warn('Failed to sync settings from storage', e);
        }
      },
      syncFromEvent: (settings) => {
        const currentAppearance = get().appearance;
        // Simple shallow comparison to prevent unnecessary updates
        const hasChanged = Object.keys(settings).some(key => 
          currentAppearance[key as keyof AppearanceSettings] !== settings[key as keyof AppearanceSettings]
        );
        if (hasChanged) {
          set(() => ({ appearance: { ...settings } }), false); // false = no persist
        }
      },
    }),
    {
      name: 'floatlearn-settings',
    }
  )
);
