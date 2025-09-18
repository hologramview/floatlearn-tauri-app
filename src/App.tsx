import { HashRouter, Route, Routes } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "./store/settings";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import type { WordData, WordDetailData, LearningSession } from "./types";

// Add pulse animation CSS
const pulseAnimation = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
    50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .flip-card {
    perspective: 1000px;
  }
  
  .flip-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.8s;
    transform-style: preserve-3d;
  }
  
  .flip-card.flipped .flip-card-inner {
    transform: rotateY(180deg);
  }
  
  .flip-card-front, .flip-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 16px;
  }
  
  .flip-card-back {
    transform: rotateY(180deg);
  }
`;

// Inject CSS into head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseAnimation;
  document.head.appendChild(style);
}

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}



function FlashCard() {
  const { appearance, updateAppearance, syncFromStorage, syncFromEvent } = useSettings();
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(false); // Start hidden
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force complete re-render
  const [fadeIn, setFadeIn] = useState(false); // Start faded out
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization
  const [showTopicMenu, setShowTopicMenu] = useState(false);
  const [showFavoritesMenu, setShowFavoritesMenu] = useState(false);
  const [showTopicsSubmenu, setShowTopicsSubmenu] = useState(false);
  const [showContentTypesSubmenu, setShowContentTypesSubmenu] = useState(false);
  const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  // const [isPaused, setIsPaused] = useState(false); // Currently disabled - manual control only
  const [flipTimer, setFlipTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedPartsOfSpeech, setSelectedPartsOfSpeech] = useState<string[]>([]);
  const positionUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // AI-powered language learning state
  const [currentWords, setCurrentWords] = useState<WordData[]>([]);
  const [currentWordDetails, setCurrentWordDetails] = useState<WordDetailData | null>(null);
  const [learningSession, setLearningSession] = useState<LearningSession | null>(null);
  const [isGeneratingWords, setIsGeneratingWords] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  const [sessionPhase, setSessionPhase] = useState<'words' | 'sentences' | 'phrasal_verbs'>('words');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoPanelFading, setInfoPanelFading] = useState(false);
  const [hoverTimeoutRef, setHoverTimeoutRef] = useState<number | null>(null);
  
  // Topic configuration - can be switched between languages, subjects, etc.
  const currentTopicType = 'languages'; // Could be 'languages', 'subjects', 'skills', etc.
  
  // Topics data structure - easily swappable
  const topicsData = {
    languages: {
      title: 'Languages',
      items: [
        { name: 'English', code: 'EN', icon: '🇬🇧' },
        { name: 'Spanish', code: 'ES', icon: '🇪🇸' },
        { name: 'French', code: 'FR', icon: '🇫🇷' },
        { name: 'German', code: 'DE', icon: '🇩🇪' },
        { name: 'Italian', code: 'IT', icon: '🇮🇹' },
        { name: 'Portuguese', code: 'PT', icon: '🇵🇹' },
        { name: 'Russian', code: 'RU', icon: '🇷🇺' },
        { name: 'Japanese', code: 'JP', icon: '🇯🇵' },
        { name: 'Korean', code: 'KR', icon: '🇰🇷' },
        { name: 'Chinese (Simplified)', code: 'CN', icon: '🇨🇳' },
        { name: 'Chinese (Traditional)', code: 'TW', icon: '🇨🇳' },
        { name: 'Arabic', code: 'AR', icon: '🇸🇦' },
        { name: 'Hindi', code: 'IN', icon: '🇮🇳' },
        { name: 'Bengali', code: 'BN', icon: '🇧🇩' },
        { name: 'Turkish', code: 'TR', icon: '🇹🇷' },
        { name: 'Dutch', code: 'NL', icon: '🇳🇱' },
        { name: 'Swedish', code: 'SE', icon: '🇸🇪' },
        { name: 'Norwegian', code: 'NO', icon: '🇳🇴' },
        { name: 'Danish', code: 'DK', icon: '🇩🇰' },
        { name: 'Finnish', code: 'FI', icon: '🇫🇮' },
        { name: 'Polish', code: 'PL', icon: '🇵🇱' },
        { name: 'Czech', code: 'CZ', icon: '🇨🇿' },
        { name: 'Hungarian', code: 'HU', icon: '🇭🇺' },
        { name: 'Romanian', code: 'RO', icon: '🇷🇴' },
        { name: 'Bulgarian', code: 'BG', icon: '🇧🇬' },
        { name: 'Greek', code: 'GR', icon: '🇬🇷' },
        { name: 'Hebrew', code: 'IL', icon: '🇮🇱' },
        { name: 'Ukrainian', code: 'UA', icon: '🇺🇦' },
        { name: 'Croatian', code: 'HR', icon: '🇭🇷' },
        { name: 'Serbian', code: 'RS', icon: '🇷🇸' },
        { name: 'Slovak', code: 'SK', icon: '🇸🇰' },
        { name: 'Slovenian', code: 'SI', icon: '🇸🇮' },
        { name: 'Estonian', code: 'EE', icon: '🇪🇪' },
        { name: 'Latvian', code: 'LV', icon: '🇱🇻' },
        { name: 'Lithuanian', code: 'LT', icon: '🇱🇹' },
        { name: 'Vietnamese', code: 'VN', icon: '🇻🇳' },
        { name: 'Thai', code: 'TH', icon: '🇹🇭' },
        { name: 'Indonesian', code: 'ID', icon: '🇮🇩' },
        { name: 'Malay', code: 'MY', icon: '🇲🇾' },
        { name: 'Persian', code: 'IR', icon: '🇮🇷' },
        { name: 'Urdu', code: 'PK', icon: '🇵🇰' },
        { name: 'Georgian', code: 'GE', icon: '🇬🇪' },
        { name: 'Armenian', code: 'AM', icon: '🇦🇲' },
        { name: 'Albanian', code: 'AL', icon: '🇦🇱' },
        { name: 'Macedonian', code: 'MK', icon: '🇲🇰' },
        { name: 'Maltese', code: 'MT', icon: '🇲🇹' },
        { name: 'Icelandic', code: 'IS', icon: '🇮🇸' },
        { name: 'Irish', code: 'IE', icon: '🇮🇪' },
        { name: 'Welsh', code: 'GB', icon: '🇬🇧' },
        { name: 'Catalan', code: 'CAT', icon: '🇪🇸' },
        { name: 'Basque', code: 'EUS', icon: '🇪🇸' }
      ]
    },
    subjects: {
      title: 'Subjects',
      items: [
        { name: 'Mathematics', code: 'MATH', icon: '🔢' },
        { name: 'Science', code: 'SCI', icon: '🔬' },
        { name: 'Physics', code: 'PHYS', icon: '⚙️' },
        { name: 'Chemistry', code: 'CHEM', icon: '⚗️' },
        { name: 'Biology', code: 'BIO', icon: '🧬' },
        { name: 'History', code: 'HIST', icon: '🏛️' },
        { name: 'Geography', code: 'GEO', icon: '🌍' },
        { name: 'Computer Science', code: 'CS', icon: '💻' },
        { name: 'Literature', code: 'LIT', icon: '📚' },
        { name: 'Music', code: 'MUS', icon: '🎵' },
        { name: 'Art', code: 'ART', icon: '🎨' },
        { name: 'Philosophy', code: 'PHIL', icon: '🤔' }
      ]
    }
  };
  
  // Get current topics
  const currentTopics = topicsData[currentTopicType as keyof typeof topicsData] || topicsData.languages;
  
  // Parts of Speech data
  const contentTypes = [
    { name: 'Noun', code: 'NOUN', icon: '🏷️', description: 'Person, place, thing, or idea' },
    { name: 'Pronoun', code: 'PRONOUN', icon: '👤', description: 'Words that replace nouns' },
    { name: 'Verb', code: 'VERB', icon: '⚡', description: 'Action or state words' },
    { name: 'Adjective', code: 'ADJECTIVE', icon: '🎨', description: 'Descriptive words' },
    { name: 'Adverb', code: 'ADVERB', icon: '🎯', description: 'Modify verbs, adjectives, other adverbs' },
    { name: 'Preposition', code: 'PREPOSITION', icon: '📍', description: 'Position and relationship words' },
    { name: 'Conjunction', code: 'CONJUNCTION', icon: '🔗', description: 'Connecting words' },
    { name: 'Interjection', code: 'INTERJECTION', icon: '❗', description: 'Exclamations and emotions' },
    { name: 'Article / Determiner', code: 'ARTICLE', icon: '🅰️', description: 'Articles and determiners' },
    { name: 'Vocabulary', code: 'VOCABULARY', icon: '🔤', description: 'General vocabulary words' },
    { name: 'Phrasal Verbs', code: 'PHRASAL_VERBS', icon: '🔀', description: 'Verb + preposition combinations' },
    { name: 'Idioms', code: 'IDIOMS', icon: '💭', description: 'Fixed expressions with figurative meaning' },
    { name: 'Collocations', code: 'COLLOCATIONS', icon: '🤝', description: 'Words that naturally go together' },
    { name: 'Particles', code: 'PARTICLES', icon: '✨', description: 'Small function words' },
    { name: 'Gerunds & Infinitives', code: 'GERUNDS_INFINITIVES', icon: '🔄', description: 'Verb forms used as nouns' },
    { name: 'Clause Types', code: 'CLAUSE_TYPES', icon: '📝', description: 'Different types of clauses' },
    { name: 'Phrases', code: 'PHRASES', icon: '💬', description: 'Groups of words with meaning' },
    { name: 'Sentences', code: 'SENTENCES', icon: '📝', description: 'Complete sentences' }
  ];
  
  // Helper functions for favorites
  const toggleFavorite = (topicCode: string) => {
    const currentFavorites = appearance.favoriteTopics || [];
    const newFavorites = currentFavorites.includes(topicCode)
      ? currentFavorites.filter(code => code !== topicCode)
      : [...currentFavorites, topicCode];
    updateAppearance({ favoriteTopics: newFavorites });
  };
  
  const isFavorite = (topicCode: string) => {
    return (appearance.favoriteTopics || []).includes(topicCode);
  };
  
  // Sort topics: favorites first, then alphabetically
  const sortedTopics = [...currentTopics.items].sort((a, b) => {
    const aFav = isFavorite(a.code);
    const bFav = isFavorite(b.code);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const favoriteTopics = sortedTopics.filter(topic => isFavorite(topic.code));
  
  // Helper functions for content type favorites
  const toggleContentTypeFavorite = (contentTypeCode: string) => {
    const currentFavorites = appearance.favoriteContentTypes || [];
    const newFavorites = currentFavorites.includes(contentTypeCode)
      ? currentFavorites.filter(code => code !== contentTypeCode)
      : [...currentFavorites, contentTypeCode];
    updateAppearance({ favoriteContentTypes: newFavorites });
  };
  
  const isContentTypeFavorite = (contentTypeCode: string) => {
    return (appearance.favoriteContentTypes || []).includes(contentTypeCode);
  };
  
  // Sort content types: favorites first, then alphabetically
  const sortedContentTypes = [...contentTypes].sort((a, b) => {
    const aFav = isContentTypeFavorite(a.code);
    const bFav = isContentTypeFavorite(b.code);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const favoriteContentTypes = sortedContentTypes.filter(contentType => isContentTypeFavorite(contentType.code));
  
  // Flash card flip functions - DISABLED (manual control only)
  // const startFlipTimer = () => {
  //   console.log('🚫 startFlipTimer called but disabled - manual control only');
  //   // NO AUTO FLIPPING - function disabled
  // };
  
  // const pauseFlipTimer = () => {
  //   console.log('🚫 pauseFlipTimer called but disabled - manual control only');
  //   // Clear any existing timers just in case
  //   if (flipTimer) {
  //     clearTimeout(flipTimer);
  //     setFlipTimer(null);
  //   }
  // };
  
  // const resumeFlipTimer = () => {
  //   console.log('🚫 resumeFlipTimer called but disabled - manual control only');
  //   // NO AUTO FLIPPING - function disabled
  // };
  
  // Initialize flash card when info panel opens - NO AUTO FLIPPING
  useEffect(() => {
    console.log(`📄 Info panel state changed: ${showInfoPanel}`);
    console.log(`🗺 Current card side: ${cardSide}`);
    
    if (showInfoPanel) {
      console.log('🏁 Starting flash card session (manual control only)');
      // Start on English side (front) by default
      setCardSide('front');
      // setIsPaused(true); // Always paused - no auto flipping (disabled)
      console.log('🚫 Auto-flipping disabled - manual control only');
    } else {
      console.log('🚫 Closing flash card session');
      // Clear any timer when card closes
      if (flipTimer) {
        clearTimeout(flipTimer);
        setFlipTimer(null);
      }
    }
    
    return () => {
      if (flipTimer) {
        clearTimeout(flipTimer);
      }
    };
  }, [showInfoPanel]);
  
  // Topics list for favorites functionality
  // Topics list for favorites functionality
  const topicsList = [
    { name: 'Random', code: 'RANDOM', icon: '🎲' },
    { name: 'Family', code: 'FAMILY', icon: '👨‍👩‍👧‍👦' },
    { name: 'Friends', code: 'FRIENDS', icon: '👥' },
    { name: 'Work', code: 'WORK', icon: '💼' },
    { name: 'Jobs', code: 'JOBS', icon: '👷' },
    { name: 'School', code: 'SCHOOL', icon: '🏫' },
    { name: 'Education', code: 'EDUCATION', icon: '🎓' },
    { name: 'Food', code: 'FOOD', icon: '🍽️' },
    { name: 'Drink', code: 'DRINK', icon: '🥤' },
    { name: 'Travel', code: 'TRAVEL', icon: '✈️' },
    { name: 'Transport', code: 'TRANSPORT', icon: '🚗' },
    { name: 'Health', code: 'HEALTH', icon: '⚕️' },
    { name: 'Medicine', code: 'MEDICINE', icon: '💊' },
    { name: 'Sports', code: 'SPORTS', icon: '⚽' },
    { name: 'Games', code: 'GAMES', icon: '🎲' },
    { name: 'Hobbies', code: 'HOBBIES', icon: '🎨' },
    { name: 'Music', code: 'MUSIC', icon: '🎵' },
    { name: 'Art', code: 'ART', icon: '🎨' },
    { name: 'Literature', code: 'LITERATURE', icon: '📚' },
    { name: 'Technology', code: 'TECHNOLOGY', icon: '💻' },
    { name: 'Internet', code: 'INTERNET', icon: '🌐' },
    { name: 'Environment', code: 'ENVIRONMENT', icon: '🌍' },
    { name: 'Nature', code: 'NATURE', icon: '🌿' },
    { name: 'Animals', code: 'ANIMALS', icon: '🐾' },
    { name: 'Plants', code: 'PLANTS', icon: '🌱' },
    { name: 'Weather', code: 'WEATHER', icon: '☀️' },
    { name: 'Climate', code: 'CLIMATE', icon: '🌡️' },
    { name: 'Shopping', code: 'SHOPPING', icon: '🛍️' },
    { name: 'Fashion', code: 'FASHION', icon: '👗' },
    { name: 'Clothes', code: 'CLOTHES', icon: '👕' },
    { name: 'Housing', code: 'HOUSING', icon: '🏠' },
    { name: 'Furniture', code: 'FURNITURE', icon: '🛋️' },
    { name: 'City', code: 'CITY', icon: '🏙️' },
    { name: 'Countryside', code: 'COUNTRYSIDE', icon: '🌾' },
    { name: 'Routine', code: 'ROUTINE', icon: '⏰' },
    { name: 'Time', code: 'TIME', icon: '🕐' },
    { name: 'Emotions', code: 'EMOTIONS', icon: '😊' },
    { name: 'Culture', code: 'CULTURE', icon: '🎭' },
    { name: 'Society', code: 'SOCIETY', icon: '🏢' },
    { name: 'Traditions', code: 'TRADITIONS', icon: '🎉' },
    { name: 'Business', code: 'BUSINESS', icon: '💼' },
    { name: 'Money', code: 'MONEY', icon: '💰' },
    { name: 'Finance', code: 'FINANCE', icon: '💳' },
    { name: 'Politics', code: 'POLITICS', icon: '🏛️' },
    { name: 'Government', code: 'GOVERNMENT', icon: '🏢' },
    { name: 'Law', code: 'LAW', icon: '⚖️' },
    { name: 'Crime', code: 'CRIME', icon: '🚔' },
    { name: 'History', code: 'HISTORY', icon: '🏛️' },
    { name: 'Religion', code: 'RELIGION', icon: '⛪' },
    { name: 'Science', code: 'SCIENCE', icon: '🔬' },
    { name: 'Space', code: 'SPACE', icon: '🌌' },
    { name: 'Energy', code: 'ENERGY', icon: '⚡' },
    { name: 'Holidays', code: 'HOLIDAYS', icon: '🏖️' },
    { name: 'Festivals', code: 'FESTIVALS', icon: '🎉' },
    { name: 'Languages', code: 'LANGUAGES', icon: '🌍' },
    { name: 'Communication', code: 'COMMUNICATION', icon: '📞' },
    { name: 'Media', code: 'MEDIA', icon: '📺' },
    { name: 'Television', code: 'TELEVISION', icon: '📺' },
    { name: 'Film', code: 'FILM', icon: '🎥' },
    { name: 'Theatre', code: 'THEATRE', icon: '🎭' },
    { name: 'Tourism', code: 'TOURISM', icon: '📷' },
    { name: 'Adventure', code: 'ADVENTURE', icon: '🏔️' },
    { name: 'Relationships', code: 'RELATIONSHIPS', icon: '💕' },
    { name: 'Marriage', code: 'MARRIAGE', icon: '💍' },
    { name: 'Childhood', code: 'CHILDHOOD', icon: '👶' },
    { name: 'Future', code: 'FUTURE', icon: '🔮' },
    { name: 'Dreams', code: 'DREAMS', icon: '💭' }
  ];
  
  // Helper functions for topic favorites
  const toggleTopicFavorite = (topicCode: string) => {
    const currentFavorites = appearance.favoriteTopics || [];
    const newFavorites = currentFavorites.includes(topicCode)
      ? currentFavorites.filter(code => code !== topicCode)
      : [...currentFavorites, topicCode];
    updateAppearance({ favoriteTopics: newFavorites });
  };
  
  const isTopicFavorite = (topicCode: string) => {
    return (appearance.favoriteTopics || []).includes(topicCode);
  };
  
  // Sort topics: favorites first, then alphabetically
  const sortedTopicsList = [...topicsList].sort((a, b) => {
    const aFav = isTopicFavorite(a.code);
    const bFav = isTopicFavorite(b.code);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const favoriteTopicsList = sortedTopicsList.filter(topic => isTopicFavorite(topic.code));
  
  // Toggle functions for checkboxes
  const toggleTopicSelection = (topicCode: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicCode) 
        ? prev.filter(code => code !== topicCode)
        : [...prev, topicCode]
    );
  };
  
  const togglePartOfSpeechSelection = (partOfSpeechCode: string) => {
    setSelectedPartsOfSpeech(prev => 
      prev.includes(partOfSpeechCode) 
        ? prev.filter(code => code !== partOfSpeechCode)
        : [...prev, partOfSpeechCode]
    );
  };
  
  // Color rotation colors
  const colorRotationColors = [
    '#FFD700', // Gold
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Orange
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3'  // Cyan
  ];
  
  // Initialize cleanly on app start
  useEffect(() => {
    const initTimeout = setTimeout(async () => {
      // Fix window interactivity first
      try {
        console.log('🔧 Fixing window interactivity...');
        await invoke('fix_window_interactivity');
        console.log('✅ Window interactivity fixed');
      } catch (error) {
        console.error('❌ Failed to fix window interactivity:', error);
      }
      
      setIsInitialized(true);
      setTextVisible(true);
      setTimeout(() => {
        setFadeIn(true);
      }, 100);
    }, 200); // Brief delay to ensure clean start
    
    return () => clearTimeout(initTimeout);
  }, []);
  
  // Apply showOnAllSpaces setting on startup
  useEffect(() => {
    const applySpacesSetting = async () => {
      try {
        await invoke('update_window_spaces', { showOnAllSpaces: appearance.showOnAllSpaces });
        console.log('Applied showOnAllSpaces setting on startup:', appearance.showOnAllSpaces);
      } catch (error) {
        console.warn('Failed to apply showOnAllSpaces setting on startup:', error);
      }
    };
    
    // Add a small delay to ensure the app is fully initialized
    const timeout = setTimeout(applySpacesSetting, 500);
    return () => clearTimeout(timeout);
  }, [appearance.showOnAllSpaces]); // Run when the setting value is available/changes

  // Initialize Native Speech Recognition
  useEffect(() => {
    console.log('🎤 Initializing native speech recognition system...');
    
    // Native speech recognition is always supported on macOS
    setSpeechSupported(true);
    setMicPermission('prompt'); // Will be determined when first attempting to record
    
    // Listen for speech recognition events from Rust backend
    const unlisten = listen('speech-recognized', (event) => {
      const text = event.payload as string;
      console.log('🎯 Native speech recognized:', text);
      setRecognizedText(text);
      
      // Process the recognized text
      handleSpeechResult(text);
      
      // Clear recognized text after 3 seconds
      setTimeout(() => {
        setRecognizedText('');
      }, 3000);
    });
    
    return () => {
      unlisten.then(f => f());
    };
  }, [appearance.selectedTopicCode]); // Reinitialize when language changes
  
  // Debug: Track showInfoPanel state changes
  useEffect(() => {
    console.log(`🔍 DEBUG: showInfoPanel state changed to ${showInfoPanel}`);
  }, [showInfoPanel]);
  
  // Debug: Track cardSide state changes
  useEffect(() => {
    console.log(`🎴 DEBUG: cardSide state changed to ${cardSide}`);
  }, [cardSide]);
  
  // Handle Escape key to close info card
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showInfoPanel) {
          closeInfoPanel();
        }
      }
    };
    
    if (showInfoPanel) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showInfoPanel]);
  
  // Helper function to get language code for speech recognition
  const getLanguageCode = () => {
    const languageMap = {
      'FR': 'fr-FR',
      'ES': 'es-ES', 
      'EN': 'en-US',
      'DE': 'de-DE',
      'IT': 'it-IT',
      'PT': 'pt-PT',
      'RU': 'ru-RU',
      'JP': 'ja-JP',
      'KR': 'ko-KR',
      'CN': 'zh-CN',
      'AR': 'ar-SA',
      'NL': 'nl-NL'
    };
    return languageMap[appearance.selectedTopicCode as keyof typeof languageMap] || 'en-US';
  };
  
  // Handle speech recognition results
  const handleSpeechResult = (transcript: string) => {
    console.log('🎯 Processing speech result:', transcript);
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // Voice commands
    if (lowerTranscript.includes('open settings') || lowerTranscript.includes('settings')) {
      handleVoiceCommand('settings');
      return;
    }
    
    if (lowerTranscript.includes('next') || lowerTranscript.includes('next word')) {
      handleVoiceCommand('next');
      return;
    }
    
    if (lowerTranscript.includes('favorite') || lowerTranscript.includes('favourites')) {
      handleVoiceCommand('favorites');
      return;
    }
    
    if (lowerTranscript.includes('topic') || lowerTranscript.includes('topics')) {
      handleVoiceCommand('topics');
      return;
    }
    
    if (lowerTranscript.includes('quit') || lowerTranscript.includes('close') || lowerTranscript.includes('exit')) {
      handleVoiceCommand('quit');
      return;
    }
    
    // Language switching commands
    const languageMatches = [
      { patterns: ['french', 'français'], code: 'FR' },
      { patterns: ['spanish', 'español'], code: 'ES' },
      { patterns: ['german', 'deutsch'], code: 'DE' },
      { patterns: ['italian', 'italiano'], code: 'IT' },
      { patterns: ['english'], code: 'EN' },
      { patterns: ['portuguese', 'português'], code: 'PT' },
      { patterns: ['russian', 'русский'], code: 'RU' },
      { patterns: ['japanese', '日本語'], code: 'JP' },
      { patterns: ['korean', '한국어'], code: 'KR' },
      { patterns: ['chinese', '中文'], code: 'CN' }
    ];
    
    for (const lang of languageMatches) {
      if (lang.patterns.some(pattern => lowerTranscript.includes(pattern))) {
        const selectedLanguage = currentTopics.items.find(item => item.code === lang.code);
        if (selectedLanguage) {
          updateAppearance({
            selectedTopicCode: selectedLanguage.code,
            selectedTopicIcon: selectedLanguage.icon
          });
        console.log(`🌍 Language switched to ${selectedLanguage.name} via voice`);
          return;
        }
      }
    }
    
    console.log(`🔍 No command matched for: "${transcript}"`);
    // If no command matched, treat as search/filter
    handleVoiceSearch(transcript);
  };
  
  // Handle voice commands
  const handleVoiceCommand = async (command: string) => {
    console.log(`🎮 Executing voice command: ${command}`);
    
    switch (command) {
      case 'settings':
        try {
          await invoke('show_settings_window');
        } catch (error) {
          console.error('Failed to open settings via voice:', error);
        }
        break;
      
      case 'next':
        // Trigger next content manually
        setFadeIn(false);
        setTextVisible(false);
        setTimeout(() => {
          setIsTransitioning(true);
          const nextIndex = (currentContentIndex + 1) % testContent.length;
          setCurrentContentIndex(nextIndex);
          setRenderKey(prev => prev + 1);
          
          if (appearance.colorRotation) {
            const newColor = colorRotationColors[nextIndex % colorRotationColors.length];
            updateAppearance({ textColor: newColor });
          }
          
          setTimeout(() => {
            setIsTransitioning(false);
            setTextVisible(true);
            setTimeout(() => setFadeIn(true), 100);
          }, 200);
        }, 300);
        break;
      
      case 'favorites':
        setShowFavoritesMenu(!showFavoritesMenu);
        setShowTopicMenu(false);
        break;
      
      case 'topics':
        setShowTopicMenu(!showTopicMenu);
        setShowFavoritesMenu(false);
        break;
      
      case 'quit':
        setShowQuitConfirmation(true);
        break;
    }
  };
  
  // Handle voice search/filter
  const handleVoiceSearch = (query: string) => {
    console.log(`🔍 Voice search for: "${query}"`);
    
    // For now, just show that speech recognition is working
    console.log(`✅ SPEECH RECOGNITION IS WORKING! You said: "${query}"`);
    
    // TODO: Implement search functionality based on recognized text
    // This could search through topics, content types, or available words/phrases
  };
  
  
  // Start/stop native speech recognition
  const toggleSpeechRecognition = async () => {
    // Check if speech recognition is enabled in settings
    if (!appearance.speechRecognitionEnabled) {
      console.warn('Speech recognition is disabled in settings');
      return;
    }
    
    if (!speechSupported) {
      console.warn('Speech recognition not available');
      return;
    }
    
    if (isListening) {
      // Stop recognition
      try {
        console.log('🔇 Stopping native speech recognition...');
      const result = await invoke('check_ollama_connection');
        console.log('✅ Speech recognition stopped:', result);
        setIsListening(false);
        setMicPermission('granted'); // Assume permission is granted if we were listening
      } catch (error) {
        console.error('Failed to stop speech recognition:', error);
        setIsListening(false);
      }
    } else {
      // Start recognition
      try {
        console.log('🎯 Starting native speech recognition...');
        const result = await invoke('start_speech_recognition');
        console.log('✅ Native speech recognition started:', result);
        
        if (result === 'recording_started') {
          setIsListening(true);
          setMicPermission('granted');
        } else if (result === 'already_recording') {
          console.log('⚠️ Speech recognition already active');
          setIsListening(true);
        }
        
      } catch (error) {
        console.error('Failed to start native speech recognition:', error);
        
        // Fallback: try the simple microphone test to at least trigger permission dialog
        try {
          console.log('🎤 Fallback: Starting basic microphone test...');
          const micResult = await invoke('start_microphone_recording');
          console.log('✅ Microphone test result:', micResult);
          
          if (micResult === 'recording_completed') {
            setMicPermission('granted');
            console.log('👍 Microphone permission likely granted. Try speech recognition again.');
          }
        } catch (micError) {
          console.error('Microphone test also failed:', micError);
          setMicPermission('denied');
        }
      }
    }
  };

  // Language-appropriate sample words based on selection
  const getLanguageWords = () => {
    const selectedLang = currentTopics.items.find(item => item.code === appearance.selectedTopicCode);
    const langCode = selectedLang?.code || 'EN';
    
    const wordsByLanguage = {
      'EN': ["Hello", "Good", "Water", "House", "Family"],
      'ES': ["Hola", "Perro", "Casa", "Agua", "Familia"],
      'FR': ["Bonjour", "Chien", "Maison", "Eau", "Famille"],
      'DE': ["Hallo", "Hund", "Haus", "Wasser", "Familie"],
      'IT': ["Ciao", "Cane", "Casa", "Acqua", "Famiglia"],
      'PT': ["Olá", "Cão", "Casa", "Água", "Família"],
      'RU': ["Привет", "Собака", "Дом", "Вода", "Семья"]
    };
    
    const words = wordsByLanguage[langCode as keyof typeof wordsByLanguage] || wordsByLanguage['EN'];
    return words.map(word => ({ text: word, type: "word" }));
  };
  
  const testContent = getLanguageWords();
  
  useEffect(() => {
    // Don't start cycling until initialized
    if (!isInitialized) {
      return;
    }
    
    const interval = setInterval(() => {
      // Start fade out
      setFadeIn(false);
      setTextVisible(false);
      
      // After fade out, change content
      setTimeout(() => {
        setIsTransitioning(true);
        const nextIndex = (currentContentIndex + 1) % testContent.length;
        setCurrentContentIndex(nextIndex);
        setRenderKey(prev => prev + 1); // Force complete component re-render
        
        // Auto color rotation
        if (appearance.colorRotation) {
          const newColor = colorRotationColors[nextIndex % colorRotationColors.length];
          updateAppearance({ textColor: newColor });
        }
        
        // Longer pause to ensure complete clearing
        setTimeout(() => {
          setIsTransitioning(false);
          setTextVisible(true);
          // Start fade in after a longer delay
          setTimeout(() => {
            setFadeIn(true);
          }, 100);
        }, 200); // Longer clearing pause to prevent remnants
      }, 300); // Wait for fade out
    }, 10000); // 10 seconds display time
    return () => clearInterval(interval);
  }, [isInitialized, currentContentIndex, appearance.colorRotation, appearance.selectedTopicCode]); // Include language selection
  
  // Topic menu stays open - only closes with X button
  // Removed auto-close behavior
  
  // Listen for settings updates from the settings window
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    listen('settings-updated', (event) => {
      console.log('Main window received settings update:', event.payload);
      // @ts-ignore
      syncFromEvent(event.payload);
    }).then(un => { unsubscribe = un; });
    
    // Also poll storage periodically as fallback
    const interval = setInterval(() => {
      syncFromStorage();
    }, 2000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [syncFromEvent, syncFromStorage]);
  
  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef) {
        clearTimeout(hoverTimeoutRef);
      }
    };
  }, [hoverTimeoutRef]);

  
  // Update window size when content or card size settings change (debounced)
  useEffect(() => {
    // Only resize during content changes, not during manual size selection
    if (!isInitialized || isTransitioning || !textVisible || !fadeIn) {
      return;
    }
    
    const currentContent = testContent[currentContentIndex];
    
    // Calculate card size based on settings
    const cardSizes = {
      small: { width: 380, height: 200 },
      large: { width: 520, height: 280 }
    };
    
    const getCardSize = (text: string) => {
      if (appearance.autoCardSize) {
        // Auto-select size based on content length
        if (text.length <= 45) {
          return cardSizes.small;
        } else {
          return cardSizes.large;
        }
      } else {
        // Use user-selected size
        return cardSizes[appearance.cardSize];
      }
    };
    
    const newDimensions = getCardSize(currentContent.text);
    
    // Longer debounce to prevent rapid resizing
    const resizeTimeout = setTimeout(async () => {
      try {
        await invoke('resize_window_for_content', {
          contentWidth: newDimensions.width,
          contentHeight: newDimensions.height
        });
      } catch (error) {
        console.warn('Failed to resize window:', error);
      }
    }, 300); // Longer delay to avoid conflicts with transitions
    
    return () => clearTimeout(resizeTimeout);
  }, [isInitialized, currentContentIndex, appearance.autoCardSize]); // Include initialization check
  
  // Handle manual card size changes separately (only when not auto-sizing)
  useEffect(() => {
    if (appearance.autoCardSize || isTransitioning) {
      return;
    }
    
    const cardSizes = {
      small: { width: 380, height: 200 },
      large: { width: 520, height: 280 }
    };
    
    const dimensions = cardSizes[appearance.cardSize];
    
    // Immediate resize for manual size changes (no debounce needed)
    const resizeForManualSize = async () => {
      try {
        await invoke('resize_window_for_content', {
          contentWidth: dimensions.width,
          contentHeight: dimensions.height
        });
      } catch (error) {
        console.warn('Failed to resize for manual size:', error);
      }
    };
    
    resizeForManualSize();
  }, [appearance.cardSize, appearance.autoCardSize, isTransitioning]);
  
  // Handle window repositioning when position settings change (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (positionUpdateTimeoutRef.current) {
      clearTimeout(positionUpdateTimeoutRef.current);
    }
    
    // Debounce position updates to prevent excessive calls
    positionUpdateTimeoutRef.current = setTimeout(async () => {
      console.log('Updating window position to grid:', appearance.positionGrid);
      try {
        await invoke('set_window_position', {
          gridPosition: appearance.positionGrid,
          randomPosition: appearance.randomPosition || false,
          manualPosition: appearance.manualPosition || false,
          manualX: appearance.manualX || 100,
          manualY: appearance.manualY || 100,
          autoDetectGrid: appearance.autoDetectGrid ?? true,
          manualGridCols: appearance.manualGridCols || 4,
          manualGridRows: appearance.manualGridRows || 3,
          preferredMonitor: (appearance.preferredMonitor || 'auto').toString()
        });
        console.log('Window position updated successfully');
      } catch (error) {
        console.warn('Failed to update window position:', error);
      }
    }, 300); // 300ms debounce
    
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
    };
  }, [appearance.positionGrid, appearance.randomPosition, appearance.manualPosition, appearance.manualX, appearance.manualY, appearance.autoDetectGrid, appearance.manualGridCols, appearance.manualGridRows, appearance.preferredMonitor]);
  
  // AI-powered learning functions
  const generateLearningWords = async () => {
    if (selectedTopics.length === 0 || selectedPartsOfSpeech.length === 0) {
      console.warn('No topics or parts of speech selected');
      return;
    }
    
    setIsGeneratingWords(true);
    try {
      // Get language from current selection
      const language = currentTopics.items.find(item => item.code === appearance.selectedTopicCode)?.name || 'French';
      const topic = selectedTopics[0]; // Use first selected topic for now
      const partOfSpeech = selectedPartsOfSpeech[0]; // Use first selected part of speech
      
      console.log(`🧠 Generating words: ${language}, ${topic}, ${partOfSpeech}`);
      
      const words: WordData[] = await invoke('generate_learning_words', {
        language,
        topic,
        partOfSpeech,
        count: 20
      });
      
      console.log(`✅ Generated ${words.length} words:`, words);
      
      setCurrentWords(words);
      setWordIndex(0);
      setSessionPhase('words');
      
      // Create learning session
      const session: LearningSession = {
        words,
        sentences: [],
        phrasal_verbs: [],
        language,
        topic,
        parts_of_speech: selectedPartsOfSpeech
      };
      setLearningSession(session);
      
      // Start the timer
      startTimer();
      
    } catch (error) {
      console.error('Failed to generate words:', error);
    } finally {
      setIsGeneratingWords(false);
    }
  };
  
  const getWordDetails = async (word: string) => {
    setCurrentWordDetails(null);
    
    try {
      const language = currentTopics.items.find(item => item.code === appearance.selectedTopicCode)?.name || 'French';
      console.log(`📖 Getting details for '${word}' in ${language}`);
      
      const details: WordDetailData = await invoke('get_word_details', {
        word,
        language
      });
      
      console.log(`✅ Retrieved details for '${word}':`, details);
      setCurrentWordDetails(details);
      
    } catch (error) {
      console.error('Failed to get word details:', error);
    }
  };
  
  const startTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    setTimerActive(true);
    const interval = setInterval(() => {
      setWordIndex(prevIndex => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= currentWords.length) {
          // Words phase complete, move to sentences
          setSessionPhase('sentences');
          setTimerActive(false);
          clearInterval(interval);
          generateSampleSentences();
          return prevIndex;
        }
        return nextIndex;
      });
    }, 15000); // 15 seconds per word (middle of 10-30 range)
    
    setTimerInterval(interval);
  };
  
  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimerActive(false);
  };
  
  const resumeTimer = () => {
    startTimer();
  };
  
  const generateSampleSentences = async () => {
    if (!learningSession) return;
    
    try {
      const wordsList = learningSession.words.map(w => w.word);
      console.log(`📝 Generating sample sentences for ${wordsList.length} words`);
      
      const sentences: string[] = await invoke('generate_sample_sentences', {
        words: wordsList,
        language: learningSession.language,
        topic: learningSession.topic
      });
      
      console.log(`✅ Generated ${sentences.length} sample sentences`);
      
      setLearningSession(prev => prev ? {
        ...prev,
        sentences
      } : null);
      
      // Move to phrasal verbs after sentences
      setTimeout(() => {
        setSessionPhase('phrasal_verbs');
        generatePhrasalVerbs();
      }, 5000); // Show sentences for 5 seconds
      
    } catch (error) {
      console.error('Failed to generate sample sentences:', error);
    }
  };
  
  const generatePhrasalVerbs = async () => {
    if (!learningSession) return;
    
    try {
      console.log(`🔀 Generating phrasal verbs for topic '${learningSession.topic}'`);
      
      const phrasalVerbs: string[] = await invoke('generate_phrasal_verbs', {
        topic: learningSession.topic,
        language: learningSession.language
      });
      
      console.log(`✅ Generated ${phrasalVerbs.length} phrasal verbs`);
      
      setLearningSession(prev => prev ? {
        ...prev,
        phrasal_verbs: phrasalVerbs
      } : null);
      
    } catch (error) {
      console.error('Failed to generate phrasal verbs:', error);
    }
  };
  
  const handleInfoIconClick = async () => {
    console.log('🔍 Info icon clicked - opening flash card');
    const currentWord = getCurrentDisplayWord();
    
    // Always open the panel for flash card functionality
    pauseTimer();
    setShowInfoPanel(true);
    
    // Get word details if we have a current word, otherwise use fallback
    if (currentWord) {
      await getWordDetails(currentWord.word);
    } else {
      console.log('📖 No current word, using fallback data');
      // Get fallback data based on selected language
      const selectedLang = currentTopics.items.find(item => item.code === appearance.selectedTopicCode);
      const langCode = selectedLang?.code || 'EN';
      const langName = selectedLang?.name || 'English';
      
      // Language-specific fallback words
      const fallbackWords = {
        'EN': { word: 'Hello', translation: 'Hello', definition: 'A greeting used when meeting someone.' },
        'ES': { word: 'Perro', translation: 'Dog', definition: 'A domesticated mammal, typically kept as a pet.' },
        'FR': { word: 'Chien', translation: 'Dog', definition: 'Un mammifère domestiqué, souvent gardé comme animal de compagnie.' },
        'DE': { word: 'Hund', translation: 'Dog', definition: 'Ein domestiziertes Säugetier, oft als Haustier gehalten.' },
        'IT': { word: 'Cane', translation: 'Dog', definition: 'Un mammifero domestico, spesso tenuto come animale domestico.' },
        'PT': { word: 'Cão', translation: 'Dog', definition: 'Um mamífero domesticado, frequentemente mantido como animal de estimação.' },
        'RU': { word: 'Собака', translation: 'Dog', definition: 'Одомашненное млекопитающее, часто содержимое как домашний питомец.' }
      };
      
      const fallback = fallbackWords[langCode as keyof typeof fallbackWords] || fallbackWords['EN'];
      
      setCurrentWordDetails({
        word: fallback.word,
        translation: fallback.translation,
        definition: fallback.definition,
        part_of_speech: 'Noun',
        phonetic: `/${fallback.word.toLowerCase()}/`,
        etymology: `From ${langName}`,
        example_sentences: [`Example sentence with ${fallback.word}.`],
        synonyms: ['Synonym1', 'Synonym2'],
        antonyms: ['Antonym1'],
        usage_notes: 'Common word',
        difficulty_level: 'Beginner',
        frequency: 'Very Common'
      });
    }
  };
  
  const closeInfoPanel = () => {
    console.log('🚫 Closing info panel - setting showInfoPanel to false');
    setShowInfoPanel(false);
    setCurrentWordDetails(null);
    
    // Clear the flip timer as well
    if (flipTimer) {
      clearTimeout(flipTimer);
      setFlipTimer(null);
    }
    
    // Reset flip states
    setCardSide('front');
    // setIsPaused(false); // Disabled since isPaused state is disabled
    
    if (sessionPhase === 'words' && currentWords.length > 0) {
      resumeTimer();
    }
  };
  
  const getCurrentDisplayWord = (): WordData | null => {
    if (sessionPhase === 'words' && currentWords.length > 0) {
      return currentWords[Math.min(wordIndex, currentWords.length - 1)];
    }
    return null;
  };
  
  const getCurrentDisplayContent = () => {
    const currentWord = getCurrentDisplayWord();
    if (currentWord) {
      return currentWord.word;
    }
    
    if (sessionPhase === 'sentences' && learningSession?.sentences.length) {
      return learningSession.sentences[0]; // Show first sentence
    }
    
    if (sessionPhase === 'phrasal_verbs' && learningSession?.phrasal_verbs.length) {
      return learningSession.phrasal_verbs[0]; // Show first phrasal verb
    }
    
    return testContent[currentContentIndex].text; // Fallback to original content
  };

  // Handle quit confirmation
  const handleQuitConfirm = async () => {
    console.log('✅ User confirmed quit - proceeding...');
    setShowQuitConfirmation(false);
    
    try {
      console.log('❌ Calling quit_app command...');
      const result = await invoke('quit_app');
      console.log('✅ App quit command result:', result);
      
      // If quit command doesn't work, try alternative
      console.log('⚠️ Quit command returned but app still running - trying alternative...');
      window.close();
    } catch (error) {
      console.error('❌ Failed to quit app:', error);
      
      // Try window.close as fallback
      console.log('🔄 Trying window.close() as fallback...');
      window.close();
    }
  };
  
  const handleQuitCancel = () => {
    console.log('❌ User cancelled quit');
    setShowQuitConfirmation(false);
  };
  
  const currentContent = {
    text: getCurrentDisplayContent()
  };
  
  return (
    <>
      {/* CSS for notification animation */}
      <style>
        {`
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -60%) scale(0.8); }
            15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -40%) scale(0.8); }
          }
        `}
      </style>
      <div style={{
      width: "100vw",
      height: "100vh", 
      backgroundColor: "transparent", // Always transparent - card handles its own background
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: appearance.fontFamily,
      // Force remove any possible borders or margins
      margin: 0,
      padding: 0,
      border: "none",
      outline: "none",
      boxSizing: "border-box",
      overflow: "hidden", // Hide overflow only for main flashcard window
      pointerEvents: "auto" // Window is interactive, but OS-level click-through handles main card
    }}>
      <div 
        style={{
          width: (() => {
            const cardSizes = {
              small: { width: 380, height: 200 },
              large: { width: 520, height: 280 }
            };
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 45) return cardSizes.small.width;
              return cardSizes.large.width;
            }
            return cardSizes[appearance.cardSize].width;
          })(),
          height: (() => {
            const cardSizes = {
              small: { width: 380, height: 200 },
              large: { width: 520, height: 280 }
            };
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 45) return cardSizes.small.height;
              return cardSizes.large.height;
            }
            return cardSizes[appearance.cardSize].height;
          })(),
          backgroundColor: appearance.cardTransparent ? `rgba(255, 255, 255, ${appearance.cardOpacity})` : appearance.cardColor,
          borderRadius: (() => {
            // Scale border radius with card size
            const baseRadius = 12;
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 45) return baseRadius; // Small card
              return baseRadius * 1.2; // Large card
            } else {
              const radiusMultiplier = {
                small: 1.0,
                large: 1.2
              };
              return baseRadius * radiusMultiplier[appearance.cardSize];
            }
          })(),
          boxShadow: (() => {
            // Scale shadow with card size
            const baseBlur = 20;
            const baseOffset = 4;
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 45) {
                return `0 ${baseOffset}px ${baseBlur}px rgba(0, 0, 0, 0.2)`; // Small card
              }
              return `0 ${baseOffset * 1.2}px ${baseBlur * 1.2}px rgba(0, 0, 0, 0.2)`; // Large card
            } else {
              const shadowMultiplier = {
                small: 1.0,
                large: 1.2
              };
              const multiplier = shadowMultiplier[appearance.cardSize];
              return `0 ${baseOffset * multiplier}px ${baseBlur * multiplier}px rgba(0, 0, 0, 0.2)`;
            }
          })(),
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "default",
          position: "relative"
        }}
      >
        {/* Text with aggressive clearing */}
        <div 
          style={{
            minHeight: "1.2em",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: (() => {
              // Scale padding with card size
              const basePadding = 8;
              if (appearance.autoCardSize) {
                if (currentContent.text.length <= 45) return `${basePadding}px`; // Small card = normal padding
                return `${basePadding * 1.3}px`; // Large card = bigger padding
              } else {
                const paddingMultiplier = {
                  small: 1.0,
                  large: 1.3
                };
                return `${basePadding * paddingMultiplier[appearance.cardSize]}px`;
              }
            })(),
            position: "relative"
          }}
        >
          {/* Render text only when fully ready and initialized */}
          {isInitialized && textVisible && !isTransitioning && fadeIn ? (
            <span
              key={`clean-text-${renderKey}-${currentContentIndex}`}
              onMouseEnter={() => {
                console.log('📜 Main word hover started - waiting 1 second...');
                // Clear any existing timeout
                if (hoverTimeoutRef) {
                  clearTimeout(hoverTimeoutRef);
                }
                // Reset fade state in case there was a pending fade out
                setInfoPanelFading(false);
                // Set new timeout to open after 1 second
                const timeout = setTimeout(() => {
                  console.log('📜 1 second elapsed - opening info panel');
                  setShowInfoPanel(true);
                  // Start fade in after a brief moment to ensure DOM is ready
                  setTimeout(() => {
                    setInfoPanelFading(true);
                  }, 10);
                }, 1000);
                setHoverTimeoutRef(timeout);
              }}
              onMouseLeave={() => {
                console.log('❌ Main word hover end - setting delayed close');
                // Clear the timeout if mouse leaves before 2 seconds
                if (hoverTimeoutRef) {
                  clearTimeout(hoverTimeoutRef);
                }
                // Set a small delay before closing to allow moving to info card
                const timeout = setTimeout(() => {
                  console.log('🕒 Delayed close timeout - fading out info panel');
                  setInfoPanelFading(false);
                  // Hide panel after fade out completes
                  setTimeout(() => {
                    setShowInfoPanel(false);
                  }, 600); // Wait for fade out transition
                }, 500); // 500ms delay to move to info card
                setHoverTimeoutRef(timeout);
              }}
              style={{
                fontSize: (() => {
                  // Scale font size with card size
                  const baseFontSize = appearance.fontSize;
                  if (appearance.autoCardSize) {
                    // Auto-sizing: font scales with content-based card size
                    if (currentContent.text.length <= 45) {
                      return baseFontSize; // Small card = normal font
                    } else {
                      return baseFontSize * 1.2; // Large card = bigger font
                    }
                  } else {
                    // Manual sizing: font scales with selected card size
                    const cardSizeMultiplier = {
                      small: 1.0,
                      large: 1.3
                    };
                    return baseFontSize * cardSizeMultiplier[appearance.cardSize];
                  }
                })(),
                fontWeight: appearance.fontWeight,
                color: appearance.textColor,
                fontFamily: appearance.fontFamily,
                textAlign: "center",
                textShadow: "none",
                userSelect: "none",
                display: "inline-block",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                cursor: "pointer",
                // Clean rendering
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale"
              }}
            >
              {currentContent.text}
            </span>
          ) : (
            // Force empty space during transitions to clear any remnants
            <span style={{ visibility: "hidden", fontSize: appearance.fontSize }}> </span>
          )}
        </div>
        {/* Topic Selector */}
        <div 
          className="topic-selector icon-bar-always-clickable"
          style={{
            position: "absolute",
            pointerEvents: "auto", // Override card's click-through
            bottom: (() => {
              // Scale position with card size
              const basePosition = 8;
              if (appearance.autoCardSize) {
                if (currentContent.text.length <= 45) return basePosition; // Small card
                return basePosition * 1.3; // Large card
              } else {
                const posMultiplier = {
                  small: 1.0,
                  large: 1.3
                };
                return basePosition * posMultiplier[appearance.cardSize];
              }
            })(),
            left: (() => {
              // Scale position with card size
              const basePosition = 8;
              if (appearance.autoCardSize) {
                if (currentContent.text.length <= 45) return basePosition; // Small card
                return basePosition * 1.3; // Large card
              } else {
                const posMultiplier = {
                  small: 1.0,
                  large: 1.3
                };
                return basePosition * posMultiplier[appearance.cardSize];
              }
            })(),
            fontSize: (() => {
              // Scale topic selector font size with card size - MADE BIGGER
              const baseSize = 16; // Increased from 11 to 16
              if (appearance.autoCardSize) {
                if (currentContent.text.length <= 45) return baseSize; // Small card
                return baseSize * 1.2; // Large card
              } else {
                const sizeMultiplier = {
                  small: 1.0,
                  large: 1.2
                };
                return baseSize * sizeMultiplier[appearance.cardSize];
              }
            })(),
            fontWeight: "600",
            opacity: 0.8,
            color: appearance.syncSymbolColor ? appearance.textColor : "inherit",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", // Always Helvetica
            cursor: "pointer",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 2
          }}>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setShowTopicMenu(!showTopicMenu);
            }}
            title={`Click to change ${currentTopics.title.toLowerCase()} or content type`}
          >
            {/* Language/Topic Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                fontSize: '1.4em', // Make flag bigger than text
                lineHeight: 1,
                position: 'relative',
                top: '2px' // Move flag down slightly to align with text
              }}>
                {appearance.selectedTopicIcon || '🇫🇷'}
              </span>
              <span style={{ 
                fontSize: '1em',
                fontWeight: '500', // Reduced from 700 to 500
                letterSpacing: '0.3px' // Reduced from 0.5px to 0.3px
              }}>
                [{appearance.selectedTopicCode || 'FR'}]
              </span>
              {timerActive && (
                <span style={{ 
                  fontSize: '0.8em',
                  color: '#ff6b35',
                  marginLeft: '4px',
                  animation: 'pulse 1s infinite'
                }}>
                  ⏱️
                </span>
              )}
            </div>
          </div>
        </div>

        
        {/* Topic Menu with Three Columns - Positioned relative to card */}
        {showTopicMenu && (
          <div 
            className="icon-bar-always-clickable"
            style={{
            position: "absolute",
            top: 0,
            left: 0,
              width: (() => {
                const cardSizes = {
                  small: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return cardSizes.small.width;
                  return cardSizes.large.width;
                }
                return cardSizes[appearance.cardSize].width;
              })(),
              height: (() => {
                const cardSizes = {
                  small: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return cardSizes.small.height;
                  return cardSizes.large.height;
                }
                return cardSizes[appearance.cardSize].height;
              })(),
              backgroundColor: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "row", // Side by side columns
              zIndex: 10000,
              overflow: "hidden",
              border: "1px solid #e0e0e0"
            }}>
            {/* Close Button - Top Right of Entire Card */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setShowTopicMenu(false);
              }}
              style={{
                position: 'absolute',
                right: 6,  // Moved further right
                top: 2,    // Moved even higher
                fontSize: 18,
                fontWeight: '900',
                color: '#000',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.7,
                zIndex: 10001,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
                // Removed backgroundColor and borderRadius
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Close menu"
            >
              ×
            </div>
              {/* Column 1: Languages with Star Favorites */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: `1px solid #e0e0e0`,
                minHeight: 0
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#2196f3',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  LANGUAGES
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '6px'
                }}>
                  {sortedTopics.map((topic) => (
                    <div
                      key={topic.code}
                      style={{
                        padding: '6px 8px',
                        fontSize: 9,
                        cursor: 'pointer',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                        backgroundColor: appearance.selectedTopicCode === topic.code 
                          ? '#e3f2fd' 
                          : 'transparent',
                        transition: 'all 0.2s ease',
                        border: appearance.selectedTopicCode === topic.code 
                          ? '1px solid #2196f3'
                          : '1px solid transparent',
                        height: '32px',
                        minHeight: '32px',
                        maxHeight: '32px'
                      }}
                      onMouseEnter={(e) => {
                        if (appearance.selectedTopicCode !== topic.code) {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                          e.currentTarget.style.border = '1px solid #ccc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (appearance.selectedTopicCode !== topic.code) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = '1px solid transparent';
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAppearance({ 
                          selectedTopic: topic.name,
                          selectedTopicCode: topic.code,
                          selectedTopicIcon: topic.icon
                        });
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{topic.icon}</span>
                      <span style={{ fontWeight: '500', flex: 1, color: '#000' }}>{topic.name}</span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(topic.code);
                        }}
                        style={{ 
                          fontSize: 10,
                          color: isFavorite(topic.code) ? '#ffd700' : '#ccc',
                          cursor: 'pointer'
                        }}
                        title={isFavorite(topic.code) ? "Remove from favorites" : "Add to favorites"}
                      >
                        {isFavorite(topic.code) ? '★' : '☆'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Column 2: Content with Hover Scroll Menus */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: `1px solid #e0e0e0`,
                minHeight: 0,
                position: 'relative'
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#6a4c93',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  CONTENT
                </div>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 6px',
                  gap: '3px'
                }}>
                  {/* Topics Section */}
                  <div 
                    style={{
                      position: 'relative'
                    }}
                    onMouseEnter={() => setShowTopicsSubmenu(true)}
                    onMouseLeave={() => setShowTopicsSubmenu(false)}
                  >
                    <div style={{
                      padding: '6px 10px',
                      backgroundColor: '#f3e5f5',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: '600',
                      color: '#6a4c93',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #e1bee7',
                      height: '32px',
                      minHeight: '32px',
                      maxHeight: '32px'
                    }}>
                      <span>Topics</span>
                      <span style={{ fontSize: 8 }}>▶</span>
                    </div>
                    
                    {/* Topics Hover Menu */}
                    {showTopicsSubmenu && (
                      <div style={{
                        position: 'absolute',
                        left: '100%',
                        top: '-36px',
                        width: 180,
                        height: '200px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #e1bee7',
                        borderRadius: 6,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                        zIndex: 10001,
                        overflowY: 'auto',
                        padding: '6px'
                      }}>
                        <div style={{
                          padding: '8px 10px',
                          fontSize: 10,
                          fontWeight: '700',
                          color: '#6a4c93',
                          textAlign: 'center',
                          backgroundColor: '#f3e5f5',
                          borderRadius: 4,
                          marginBottom: '6px'
                        }}>
                          Select Topic
                        </div>
                        <div style={{
                          maxHeight: '140px',
                          overflowY: 'auto'
                        }}>
                          {[
                            { name: 'Random', code: 'RANDOM', icon: '🎲' },
                            { name: 'Family', code: 'FAMILY', icon: '👨‍👩‍👧‍👦' },
                            { name: 'Friends', code: 'FRIENDS', icon: '👥' },
                            { name: 'Work', code: 'WORK', icon: '💼' },
                            { name: 'Jobs', code: 'JOBS', icon: '👷' },
                            { name: 'School', code: 'SCHOOL', icon: '🏫' },
                            { name: 'Education', code: 'EDUCATION', icon: '🎓' },
                            { name: 'Food', code: 'FOOD', icon: '🍽️' },
                            { name: 'Drink', code: 'DRINK', icon: '🥤' },
                            { name: 'Travel', code: 'TRAVEL', icon: '✈️' },
                            { name: 'Transport', code: 'TRANSPORT', icon: '🚗' },
                            { name: 'Health', code: 'HEALTH', icon: '⚕️' },
                            { name: 'Medicine', code: 'MEDICINE', icon: '💊' },
                            { name: 'Sports', code: 'SPORTS', icon: '⚽' },
                            { name: 'Games', code: 'GAMES', icon: '🎲' },
                            { name: 'Hobbies', code: 'HOBBIES', icon: '🎨' },
                            { name: 'Music', code: 'MUSIC', icon: '🎵' },
                            { name: 'Art', code: 'ART', icon: '🎨' },
                            { name: 'Literature', code: 'LITERATURE', icon: '📚' },
                            { name: 'Technology', code: 'TECHNOLOGY', icon: '💻' },
                            { name: 'Internet', code: 'INTERNET', icon: '🌐' },
                            { name: 'Environment', code: 'ENVIRONMENT', icon: '🌍' },
                            { name: 'Nature', code: 'NATURE', icon: '🌿' },
                            { name: 'Animals', code: 'ANIMALS', icon: '🐾' },
                            { name: 'Plants', code: 'PLANTS', icon: '🌱' },
                            { name: 'Weather', code: 'WEATHER', icon: '☀️' },
                            { name: 'Climate', code: 'CLIMATE', icon: '🌡️' },
                            { name: 'Shopping', code: 'SHOPPING', icon: '🛍️' },
                            { name: 'Fashion', code: 'FASHION', icon: '👗' },
                            { name: 'Clothes', code: 'CLOTHES', icon: '👕' },
                            { name: 'Housing', code: 'HOUSING', icon: '🏠' },
                            { name: 'Furniture', code: 'FURNITURE', icon: '🛋️' },
                            { name: 'City', code: 'CITY', icon: '🏙️' },
                            { name: 'Countryside', code: 'COUNTRYSIDE', icon: '🌾' },
                            { name: 'Routine', code: 'ROUTINE', icon: '⏰' },
                            { name: 'Time', code: 'TIME', icon: '🕐' },
                            { name: 'Emotions', code: 'EMOTIONS', icon: '😊' },
                            { name: 'Culture', code: 'CULTURE', icon: '🎭' },
                            { name: 'Society', code: 'SOCIETY', icon: '🏢' },
                            { name: 'Traditions', code: 'TRADITIONS', icon: '🎉' },
                            { name: 'Business', code: 'BUSINESS', icon: '💼' },
                            { name: 'Money', code: 'MONEY', icon: '💰' },
                            { name: 'Finance', code: 'FINANCE', icon: '💳' },
                            { name: 'Politics', code: 'POLITICS', icon: '🏛️' },
                            { name: 'Government', code: 'GOVERNMENT', icon: '🏢' },
                            { name: 'Law', code: 'LAW', icon: '⚖️' },
                            { name: 'Crime', code: 'CRIME', icon: '🚔' },
                            { name: 'History', code: 'HISTORY', icon: '🏛️' },
                            { name: 'Religion', code: 'RELIGION', icon: '⛪' },
                            { name: 'Science', code: 'SCIENCE', icon: '🔬' },
                            { name: 'Space', code: 'SPACE', icon: '🌌' },
                            { name: 'Energy', code: 'ENERGY', icon: '⚡' },
                            { name: 'Holidays', code: 'HOLIDAYS', icon: '🏖️' },
                            { name: 'Festivals', code: 'FESTIVALS', icon: '🎉' },
                            { name: 'Languages', code: 'LANGUAGES', icon: '🌍' },
                            { name: 'Communication', code: 'COMMUNICATION', icon: '📞' },
                            { name: 'Media', code: 'MEDIA', icon: '📺' },
                            { name: 'Television', code: 'TELEVISION', icon: '📺' },
                            { name: 'Film', code: 'FILM', icon: '🎥' },
                            { name: 'Theatre', code: 'THEATRE', icon: '🎭' },
                            { name: 'Tourism', code: 'TOURISM', icon: '📷' },
                            { name: 'Adventure', code: 'ADVENTURE', icon: '🏔️' },
                            { name: 'Relationships', code: 'RELATIONSHIPS', icon: '💕' },
                            { name: 'Marriage', code: 'MARRIAGE', icon: '💍' },
                            { name: 'Childhood', code: 'CHILDHOOD', icon: '👶' },
                            { name: 'Future', code: 'FUTURE', icon: '🔮' },
                            { name: 'Dreams', code: 'DREAMS', icon: '💭' }
                          ].map((topic) => (
                            <div
                              key={topic.code}
                              style={{
                                padding: '4px 8px',
                                fontSize: 9,
                                cursor: 'pointer',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginBottom: '1px',
                                backgroundColor: 'transparent',
                                transition: 'all 0.2s ease',
                                border: '1px solid transparent'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3e5f5';
                                e.currentTarget.style.border = '1px solid #6a4c93';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.border = '1px solid transparent';
                              }}
                              onClick={() => {
                                // Handle topic selection
                                console.log('Selected topic:', topic.name);
                              }}
                            >
                              <span style={{ fontSize: 11 }}>{topic.icon}</span>
                              <span style={{ fontWeight: '500' }}>{topic.name}</span>
                              {topic.code !== 'RANDOM' && (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTopicSelection(topic.code);
                                  }}
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 2,
                                    border: '1px solid #6a4c93',
                                    backgroundColor: selectedTopics.includes(topic.code) ? '#6a4c93' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 8,
                                    color: selectedTopics.includes(topic.code) ? 'white' : '#6a4c93',
                                  }}
                                >
                                  {selectedTopics.includes(topic.code) && '✓'}
                                </div>
                              )}
                              {/* Star icon - after checkbox */}
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTopicFavorite(topic.code);
                                }}
                                style={{
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  color: isTopicFavorite(topic.code) ? '#ffa000' : '#ccc',
                                  transition: 'color 0.2s ease',
                                  marginLeft: '4px'
                                }}
                                title={isTopicFavorite(topic.code) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                {isTopicFavorite(topic.code) ? '⭐' : '☆'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Types Section */}
                  <div 
                    style={{
                      position: 'relative'
                    }}
                    onMouseEnter={() => setShowContentTypesSubmenu(true)}
                    onMouseLeave={() => setShowContentTypesSubmenu(false)}
                  >
                    <div style={{
                      padding: '6px 10px',
                      backgroundColor: '#e8f5e8',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: '600',
                      color: '#2e7d32',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #c8e6c9',
                      height: '32px',
                      minHeight: '32px',
                      maxHeight: '32px'
                    }}>
                      <span>Parts of Speech</span>
                      <span style={{ fontSize: 8 }}>▶</span>
                    </div>
                    
                    {/* Content Types Hover Menu */}
                    {showContentTypesSubmenu && (
                      <div style={{
                        position: 'absolute',
                        left: '100%',
                        top: '-71px',
                        width: 180,
                        height: '200px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #c8e6c9',
                        borderRadius: 6,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                        zIndex: 10001,
                        overflowY: 'auto',
                        padding: '6px'
                      }}>
                        <div style={{
                          padding: '8px 10px',
                          fontSize: 10,
                          fontWeight: '700',
                          color: '#2e7d32',
                          textAlign: 'left',
                          backgroundColor: '#e8f5e8',
                          borderRadius: 4,
                          marginBottom: '6px'
                        }}>
                          Select Parts of Speech
                        </div>
                        <div style={{
                          maxHeight: '140px',
                          overflowY: 'auto'
                        }}>
                          {contentTypes.map((contentType) => (
                            <div
                              key={contentType.code}
                              style={{
                                padding: '4px 8px',
                                fontSize: 9,
                                cursor: 'pointer',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginBottom: '1px',
                                backgroundColor: 'transparent',
                                transition: 'all 0.2s ease',
                                border: '1px solid transparent'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f1f8e9';
                                e.currentTarget.style.border = '1px solid #81c784';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.border = '1px solid transparent';
                              }}
                              onClick={() => {
                                // Handle content type selection
                                console.log('Toggle content type:', contentType.name);
                              }}
                            >
                              <span style={{ fontSize: 11 }}>{contentType.icon}</span>
                              <span style={{ fontWeight: '500' }}>{contentType.name}</span>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePartOfSpeechSelection(contentType.code);
                                }}
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 2,
                                  border: '1px solid #2e7d32',
                                  backgroundColor: selectedPartsOfSpeech.includes(contentType.code) ? '#2e7d32' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 8,
                                  color: selectedPartsOfSpeech.includes(contentType.code) ? 'white' : '#2e7d32'
                                }}
                              >
                                {selectedPartsOfSpeech.includes(contentType.code) && '✓'}
                              </div>
                              {/* Star icon - after checkbox */}
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleContentTypeFavorite(contentType.code);
                                }}
                                style={{
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  color: isContentTypeFavorite(contentType.code) ? '#ffa000' : '#ccc',
                                  transition: 'color 0.2s ease',
                                  marginLeft: '4px'
                                }}
                                title={isContentTypeFavorite(contentType.code) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                {isContentTypeFavorite(contentType.code) ? '⭐' : '☆'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Column 3: Selected Configuration Summary */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#ff6b35',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  SELECTED
                </div>
                <div style={{
                  flex: 1,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {/* Language */}
                  <div style={{ fontSize: 10, lineHeight: 1.2 }}>
                    <span style={{ fontWeight: '700', color: '#1976d2' }}>Language: </span>
                    <span style={{ fontWeight: '600', color: '#000' }}>{appearance.selectedTopic}</span>
                  </div>
                  
                  {/* Topics */}
                  <div style={{ fontSize: 10, lineHeight: 1.2 }}>
                    <span style={{ fontWeight: '700', color: '#6a4c93' }}>Topic: </span>
                    <span style={{ fontWeight: '600', color: '#000' }}>
                      {selectedTopics.length === 0 ? 'None' : 
                       selectedTopics.length === 1 ? 
                         (() => {
                           const topicsList = [
                             'Random', 'Family', 'Friends', 'Work', 'Jobs', 'School', 'Education', 'Food', 'Drink', 'Travel', 'Transport',
                             'Health', 'Medicine', 'Sports', 'Games', 'Hobbies', 'Music', 'Art', 'Literature', 'Technology', 'Internet',
                             'Environment', 'Nature', 'Animals', 'Plants', 'Weather', 'Climate', 'Shopping', 'Fashion', 'Clothes',
                             'Housing', 'Furniture', 'City', 'Countryside', 'Routine', 'Time', 'Emotions', 'Culture', 'Society',
                             'Traditions', 'Business', 'Money', 'Finance', 'Politics', 'Government', 'Law', 'Crime', 'History',
                             'Religion', 'Science', 'Space', 'Energy', 'Holidays', 'Festivals', 'Languages', 'Communication',
                             'Media', 'Television', 'Film', 'Theatre', 'Tourism', 'Adventure', 'Relationships', 'Marriage',
                             'Childhood', 'Future', 'Dreams'
                           ];
                           const codes = ['RANDOM', 'FAMILY', 'FRIENDS', 'WORK', 'JOBS', 'SCHOOL', 'EDUCATION', 'FOOD', 'DRINK', 'TRAVEL', 'TRANSPORT',
                             'HEALTH', 'MEDICINE', 'SPORTS', 'GAMES', 'HOBBIES', 'MUSIC', 'ART', 'LITERATURE', 'TECHNOLOGY', 'INTERNET',
                             'ENVIRONMENT', 'NATURE', 'ANIMALS', 'PLANTS', 'WEATHER', 'CLIMATE', 'SHOPPING', 'FASHION', 'CLOTHES',
                             'HOUSING', 'FURNITURE', 'CITY', 'COUNTRYSIDE', 'ROUTINE', 'TIME', 'EMOTIONS', 'CULTURE', 'SOCIETY',
                             'TRADITIONS', 'BUSINESS', 'MONEY', 'FINANCE', 'POLITICS', 'GOVERNMENT', 'LAW', 'CRIME', 'HISTORY',
                             'RELIGION', 'SCIENCE', 'SPACE', 'ENERGY', 'HOLIDAYS', 'FESTIVALS', 'LANGUAGES', 'COMMUNICATION',
                             'MEDIA', 'TELEVISION', 'FILM', 'THEATRE', 'TOURISM', 'ADVENTURE', 'RELATIONSHIPS', 'MARRIAGE',
                             'CHILDHOOD', 'FUTURE', 'DREAMS'];
                           const index = codes.indexOf(selectedTopics[0]);
                           return index !== -1 ? topicsList[index] : selectedTopics[0];
                         })() :
                       'Multiple'
                      }
                    </span>
                  </div>
                  
                  {/* Parts of Speech */}
                  <div style={{ fontSize: 10, lineHeight: 1.2 }}>
                    <span style={{ fontWeight: '700', color: '#2e7d32' }}>Part of speech: </span>
                    <span style={{ fontWeight: '600', color: '#000' }}>
                      {selectedPartsOfSpeech.length === 0 ? 'None' : 
                       selectedPartsOfSpeech.length === 1 ? 
                         (() => {
                           const partsList = [
                             'Noun', 'Pronoun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Interjection',
                             'Article / Determiner', 'Vocabulary', 'Phrasal Verbs', 'Idioms', 'Collocations', 'Particles',
                             'Gerunds & Infinitives', 'Clause Types', 'Phrases', 'Sentences'
                           ];
                           const codes = [
                             'NOUN', 'PRONOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PREPOSITION', 'CONJUNCTION', 'INTERJECTION',
                             'ARTICLE', 'VOCABULARY', 'PHRASAL_VERBS', 'IDIOMS', 'COLLOCATIONS', 'PARTICLES',
                             'GERUNDS_INFINITIVES', 'CLAUSE_TYPES', 'PHRASES', 'SENTENCES'
                           ];
                           const index = codes.indexOf(selectedPartsOfSpeech[0]);
                           return index !== -1 ? partsList[index] : selectedPartsOfSpeech[0];
                         })() :
                       'Multiple'
                      }
                    </span>
                  </div>
                  
                  {/* Divider */}
                  <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }}></div>
                  
                  {/* Speak Words */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 10
                  }}>
                    <span style={{ fontWeight: '600', color: '#000' }}>Speak words</span>
                    <div 
                      onClick={() => {
                        console.log('Toggle speak words');
                      }}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        border: '1px solid #4caf50',
                        backgroundColor: '#4caf50',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        color: 'white'
                      }}
                    >
                      ✓
                    </div>
                  </div>
                  
                  {/* Action Buttons Container */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}>
                    {/* Practice */}
                    <div 
                      onClick={() => {
                        console.log('Start practice');
                      }}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1976d2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#2196f3';
                      }}
                    >
                      Practice
                    </div>
                    
                    {/* Quiz */}
                    <div 
                      onClick={() => {
                        console.log('Start quiz');
                      }}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f57c00';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff9800';
                      }}
                    >
                      Quiz
                    </div>
                    
                    {/* Conversation */}
                    <div 
                      onClick={() => {
                        console.log('Start conversation');
                      }}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: '#9c27b0',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#7b1fa2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#9c27b0';
                      }}
                    >
                      Conversation
                    </div>
                  </div>
                  
                  {/* Apply Button */}
                  <div style={{
                    marginTop: 'auto',
                    padding: '4px 0'
                  }}>
                    <button
                      onClick={async () => {
                        console.log('🧠 Applying AI settings and generating words...');
                        setShowTopicMenu(false);
                        await generateLearningWords();
                      }}
                      disabled={isGeneratingWords}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        backgroundColor: '#ff6b35',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e55a2b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff6b35';
                      }}
                    >
                      {isGeneratingWords ? 'GENERATING...' : 'APPLY SETTINGS'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        
        {/* Favorites Menu - Only show favorites */}
        {showFavoritesMenu && (
          <div 
            className="icon-bar-always-clickable"
            style={{
            position: "absolute",
            top: 0,
            left: 0,
              width: (() => {
                const cardSizes = {
                  small: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return cardSizes.small.width;
                  return cardSizes.large.width;
                }
                return cardSizes[appearance.cardSize].width;
              })(),
              height: (() => {
                const cardSizes = {
                  small: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return cardSizes.small.height;
                  return cardSizes.large.height;
                }
                return cardSizes[appearance.cardSize].height;
              })(),
              backgroundColor: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "row", // Three columns: Languages, Topics, and Parts of Speech
              zIndex: 10000,
              overflow: "hidden",
              border: "1px solid #e0e0e0"
            }}>
            {/* Close Button - Top Right of Entire Card */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setShowFavoritesMenu(false);
              }}
              style={{
                position: 'absolute',
                right: 6,  // Moved further right
                top: 2,    // Moved even higher
                fontSize: 18,
                fontWeight: '900',
                color: '#000',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.7,
                zIndex: 10001,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
                // Removed backgroundColor and borderRadius
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Close favorites"
            >
              ×
            </div>
              {/* Column 1: Favorite Languages */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: `1px solid #e0e0e0`,
                minHeight: 0
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#ffa000',
                  textAlign: 'center',
                  backgroundColor: '#fff9c4',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  LANGUAGES
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '6px'
                }}>
                  {favoriteTopics.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      fontSize: 10,
                      fontStyle: 'italic'
                    }}>
                      No favorite languages yet.

                      Click the ⭐ in the main menu to add favorites.
                    </div>
                  ) : (
                    favoriteTopics.map((topic) => (
                      <div
                        key={topic.code}
                        style={{
                          padding: '6px 8px',
                          fontSize: 9,
                          cursor: 'pointer',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '2px',
                          backgroundColor: appearance.selectedTopicCode === topic.code 
                            ? '#fff3e0' 
                            : 'transparent',
                          transition: 'all 0.2s ease',
                          border: appearance.selectedTopicCode === topic.code 
                            ? '1px solid #ffa000'
                            : '1px solid transparent',
                          height: '32px',
                          minHeight: '32px',
                          maxHeight: '32px'
                        }}
                        onMouseEnter={(e) => {
                          if (appearance.selectedTopicCode !== topic.code) {
                            e.currentTarget.style.backgroundColor = '#fff8e1';
                            e.currentTarget.style.border = '1px solid #ffcc02';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (appearance.selectedTopicCode !== topic.code) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.border = '1px solid transparent';
                          }
                        }}
                        onClick={() => {
                          updateAppearance({
                            selectedTopicCode: topic.code,
                            selectedTopicIcon: topic.icon
                          });
                          setShowFavoritesMenu(false);
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{topic.icon}</span>
                        <span style={{ fontWeight: '600', flex: 1 }}>{topic.name}</span>
                        <span style={{ 
                          fontSize: 8, 
                          color: '#666', 
                          fontWeight: '500'
                        }}>{topic.code}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Column 2: Favorite Topics */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: `1px solid #e0e0e0`,
                minHeight: 0
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#ffa000',
                  textAlign: 'center',
                  backgroundColor: '#fff9c4',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  TOPICS
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '6px'
                }}>
                  {favoriteTopicsList.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      fontSize: 10,
                      fontStyle: 'italic'
                    }}>
                      No favorite topics yet.

                      Click the ⭐ in the main menu to add favorites.
                    </div>
                  ) : (
                    favoriteTopicsList.map((topic) => (
                      <div
                        key={topic.code}
                        style={{
                          padding: '6px 8px',
                          fontSize: 9,
                          cursor: 'pointer',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '2px',
                          backgroundColor: 'transparent',
                          transition: 'all 0.2s ease',
                          border: '1px solid transparent',
                          height: '32px',
                          minHeight: '32px',
                          maxHeight: '32px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fff8e1';
                          e.currentTarget.style.border = '1px solid #ffcc02';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = '1px solid transparent';
                        }}
                        onClick={() => {
                          console.log('Selected favorite topic:', topic.name);
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{topic.icon}</span>
                        <span style={{ fontWeight: '600', flex: 1 }}>{topic.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Column 3: Favorite Parts of Speech */}
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0
              }}>
                <div style={{
                  padding: '8px 12px 6px',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#ffa000',
                  textAlign: 'center',
                  backgroundColor: '#fff9c4',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  PARTS
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '6px'
                }}>
                  {favoriteContentTypes.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      fontSize: 10,
                      fontStyle: 'italic'
                    }}>
                      No favorite parts of speech yet.

                      Click the ⭐ in the main menu to add favorites.
                    </div>
                  ) : (
                    favoriteContentTypes.map((contentType) => (
                      <div
                        key={contentType.code}
                        style={{
                          padding: '6px 8px',
                          fontSize: 9,
                          cursor: 'pointer',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '2px',
                          backgroundColor: 'transparent',
                          transition: 'all 0.2s ease',
                          border: '1px solid transparent',
                          height: '32px',
                          minHeight: '32px',
                          maxHeight: '32px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fff8e1';
                          e.currentTarget.style.border = '1px solid #ffcc02';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.border = '1px solid transparent';
                        }}
                        onClick={() => {
                          console.log('Selected content type:', contentType.name);
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{contentType.icon}</span>
                        <span style={{ fontWeight: '600', flex: 1 }}>{contentType.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        
        {/* Bottom Bar - Exact same alignment as flag */}
        <div 
          style={{
            position: "absolute",
            bottom: -2, // Move down tiny bit more to perfect alignment with flag
            right: (() => {
              // EXACT same position logic as flag but on right side
              const basePosition = 8;
              if (appearance.autoCardSize) {
                if (currentContent.text.length <= 45) return basePosition; // Small card
                return basePosition * 1.3; // Large card
              } else {
                const posMultiplier = {
                  small: 1.0,
                  large: 1.3
                };
                return basePosition * posMultiplier[appearance.cardSize];
              }
            })(),
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",
            zIndex: 1000
          }}
        >
          {/* Drag Handle */}
          <div 
            style={{
              cursor: "grab",
              fontSize: (() => {
                // Same font size scaling as language chooser
                const baseSize = 14;
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return baseSize;
                  return baseSize * 1.2;
                } else {
                  const sizeMultiplier = {
                    small: 1.0,
                    large: 1.2
                  };
                  return baseSize * sizeMultiplier[appearance.cardSize];
                }
              })(),
              color: "#ffffff",
              opacity: 0.8,
              transition: "all 0.2s ease",
              userSelect: "none",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              fontWeight: "bold"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onMouseDown={async (e) => {
              e.currentTarget.style.cursor = "grabbing";
              
              try {
                console.log('👍 Starting window drag...');
                await invoke('test_drag');
                console.log('✅ Drag initiated');
              } catch (error) {
                console.error('❌ Drag failed:', error);
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.cursor = "grab";
            }}
            title="Click and hold to drag window"
          >
            ✊
          </div>
          
          {/* Favorites Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: (() => {
                // Same font size scaling as language chooser
                const baseSize = 14;
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return baseSize;
                  return baseSize * 1.2;
                } else {
                  const sizeMultiplier = {
                    small: 1.0,
                    large: 1.2
                  };
                  return baseSize * sizeMultiplier[appearance.cardSize];
                }
              })(),
              color: "#ffa000",
              opacity: 0.8,
              transition: "opacity 0.2s ease",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: "600"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
            onClick={() => {
              setShowFavoritesMenu(!showFavoritesMenu);
              setShowTopicMenu(false);
            }}
            title="Favorites"
          >
            ⭐
          </div>
            
            {/* Parts of Speech Info Icon */}
            <div 
              style={{
                cursor: "pointer",
                fontSize: 14,
                color: "#000000",
                opacity: 0.8,
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onClick={() => {
                console.log('Word info clicked');
                handleInfoIconClick();
              }}
              title="Get detailed word information"
            >
              ❔
            </div>
            
            {/* Mic Icon */}
            <div 
              style={{
                cursor: (speechSupported && appearance.speechRecognitionEnabled) ? "pointer" : "not-allowed",
                fontSize: 14,
                opacity: (() => {
                  if (!speechSupported || !appearance.speechRecognitionEnabled) return 0.3;
                  if (isListening) return 1.0;
                  // In Tauri, we let Speech API handle permissions, so show as available
                  return 0.6;
                })(),
                transition: "all 0.3s ease",
                color: (() => {
                  if (isListening) return "#000000"; // Black when recording
                  if (!speechSupported || !appearance.speechRecognitionEnabled) return "#666666"; // Dark gray when disabled/unsupported
                  return "#000000"; // Default black color - ready to use
                })(),
                // Force text color override to prevent inheritance
                WebkitTextFillColor: (() => {
                  if (isListening) return "#000000";
                  if (!speechSupported || !appearance.speechRecognitionEnabled) return "#666666";
                  return "#000000"; // Default black - ready to use
                })(),
                transform: isListening ? "scale(1.1)" : "scale(1.0)",
                textShadow: isListening ? "0 0 8px rgba(255, 68, 68, 0.6)" : "none",
                border: isListening ? "2px solid #ff4444" : "2px solid transparent", // Red border when recording
                borderRadius: "50%", // Make it circular
                padding: "4px" // Add padding so border doesn't touch icon
              }}
              onMouseEnter={(e) => { 
                if (speechSupported && appearance.speechRecognitionEnabled) e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => { 
                if (!isListening && speechSupported && appearance.speechRecognitionEnabled) {
                  e.currentTarget.style.opacity = micPermission === 'denied' ? "0.4" : "0.6";
                }
              }}
              onClick={async () => {
                // Debug current state
                console.log('🎤 Microphone clicked! Current state:');
                console.log('- speechSupported:', speechSupported);
                console.log('- speechRecognitionEnabled:', appearance.speechRecognitionEnabled);
                console.log('- isListening:', isListening);
                console.log('- micPermission:', micPermission);
                
                // If speech recognition is disabled or not supported, open settings
                if (!appearance.speechRecognitionEnabled || !speechSupported) {
                  try {
                    console.log('🎤 Opening settings for speech recognition setup...');
                    await invoke('show_settings_window');
                  } catch (error) {
                    console.error('Failed to open settings:', error);
                  }
                  return;
                }
                
                // If we get "not-allowed" error, open macOS system preferences
                console.log('🎤 Attempting to start speech recognition (will handle permissions if denied)...');
                
                // Otherwise, toggle speech recognition
                console.log('✅ Attempting to toggle speech recognition...');
                toggleSpeechRecognition();
              }}
              title={(() => {
                if (!appearance.speechRecognitionEnabled) return "Speech recognition disabled - Click to open settings";
                if (!speechSupported) return "Speech recognition not supported - Click to open settings";
                if (isListening) return "Click to stop listening";
                return `Click to start voice input (${getLanguageCode()}) - May request microphone permission`;
              })()}
            >
              {(() => {
                if (isListening) return "🔴"; // Red circle when recording
                if (micPermission === 'denied') return "🎤"; // Regular mic when denied
                if (recognizedText && !isListening) return "✅"; // Checkmark after successful recognition
                return "🎤"; // Regular microphone
              })()}
            </div>
            
            {/* AI Assistant Icon */}
            <div 
              style={{
                cursor: "pointer",
                fontSize: 14,
                opacity: 0.6,
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onClick={() => console.log('AI Assistant clicked')}
              title="AI Assistant"
            >
              🤖
            </div>
            
            {/* Audio Icon */}
            <div 
              style={{
                cursor: "pointer",
                fontSize: 14,
                opacity: 0.6,
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onClick={() => console.log('Audio clicked')}
              title="Audio"
            >
              🔊
            </div>
            
          {/* Settings Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: (() => {
                // Same font size scaling as language chooser
                const baseSize = 14;
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return baseSize;
                  return baseSize * 1.2;
                } else {
                  const sizeMultiplier = {
                    small: 1.0,
                    large: 1.2
                  };
                  return baseSize * sizeMultiplier[appearance.cardSize];
                }
              })(),
              color: appearance.syncSymbolColor ? appearance.textColor : "#ffffff",
              opacity: 0.8,
              transition: "opacity 0.2s ease",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: "600"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onClick={async () => {
              try {
                console.log('⚙️ Opening settings window...');
                await invoke('show_settings_window');
                console.log('✅ Settings window opened');
              } catch (error) {
                console.error('❌ Failed to open settings:', error);
              }
            }}
            title="Settings (Click to test)"
          >
            ⚙️
          </div>
          
          {/* Quit/Close X Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: (() => {
                // Make X much bigger than other icons
                const baseSize = 24; // Increased from 18 to 24
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 45) return baseSize;
                  return baseSize * 1.2;
                } else {
                  const sizeMultiplier = {
                    small: 1.0,
                    large: 1.2
                  };
                  return baseSize * sizeMultiplier[appearance.cardSize];
                }
              })(),
              color: "#ff4444", // Red color for quit
              opacity: 0.8,
              transition: "all 0.2s ease",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: "900", // Extra bold for X
              padding: "6px 8px", // Increased padding for bigger presence
              borderRadius: "4px",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)", // Add shadow for better visibility
              pointerEvents: "auto", // Ensure it's clickable
              zIndex: 1001, // Make sure it's on top
              position: "relative", // Ensure positioning context
              top: "-2px", // Move X icon up slightly
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.backgroundColor = "rgba(255, 68, 68, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.8";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowQuitConfirmation(true);
            }}
            title="Quit Floatlearn"
          >
            ×
          </div>
        </div>
        
        {/* Speech Recognition Display */}
        {(isListening || recognizedText) && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isListening ? 'rgba(255, 68, 68, 0.9)' : 'rgba(0, 150, 0, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            minWidth: '120px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            animation: isListening ? 'pulse 1.5s infinite' : 'none'
          }}>
            {isListening ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span>🎤</span>
                <span>Listening...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span>✅</span>
                <span>{recognizedText}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Custom Quit Confirmation Dialog */}
        {showQuitConfirmation && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 24,
              width: 280,
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              margin: '20px'
            }}>
              <div style={{
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 12,
                color: '#333'
              }}>
                Quit Floatlearn?
              </div>
              <div style={{
                fontSize: 14,
                color: '#666',
                marginBottom: 20,
                lineHeight: 1.4
              }}>
                Are you sure you want to quit the application?
              </div>
              <div style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%'
              }}>
                <button
                  onClick={handleQuitCancel}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '2px solid #ccc',
                    backgroundColor: '#f8f8f8',
                    color: '#333',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuitConfirm}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '2px solid #ff4444',
                    backgroundColor: '#ff4444',
                    color: '#000000',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  QUIT
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Swiveling Flash Card */}
        {showInfoPanel && (
          <div 
            key={`flash-card-${showInfoPanel ? 'open' : 'closed'}`}
            onMouseEnter={() => {
              console.log('📜 Info card hover - staying open');
              // Keep panel open and faded in
              setInfoPanelFading(true);
            }}
            onMouseLeave={() => {
              console.log('❌ Info card hover end - closing panel');
              // Close immediately when leaving the entire card
              setInfoPanelFading(false);
              // Hide panel after fade out completes
              setTimeout(() => {
                setShowInfoPanel(false);
              }, 600);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              pointerEvents: 'auto',
              opacity: infoPanelFading ? 1 : 0,
              transition: 'opacity 0.6s ease-in-out'
            }}
          >
            <div 
              className={`flip-card ${cardSide === 'back' ? 'flipped' : ''}`}
              style={{
                width: (() => {
                  const cardSizes = {
                    small: { width: 380, height: 200 },
                    large: { width: 520, height: 280 }
                  };
                  if (appearance.autoCardSize) {
                    if (currentContent.text.length <= 45) return cardSizes.small.width;
                    return cardSizes.large.width;
                  }
                  return cardSizes[appearance.cardSize].width;
                })(),
                height: (() => {
                  const cardSizes = {
                    small: { width: 380, height: 200 },
                    large: { width: 520, height: 280 }
                  };
                  if (appearance.autoCardSize) {
                    if (currentContent.text.length <= 45) return cardSizes.small.height;
                    return cardSizes.large.height;
                  }
                  return cardSizes[appearance.cardSize].height;
                })(),
                boxShadow: (() => {
                  // Match main card shadow scaling
                  const baseBlur = 20;
                  const baseOffset = 4;
                  if (appearance.autoCardSize) {
                    if (currentContent.text.length <= 45) {
                      return `0 ${baseOffset}px ${baseBlur}px rgba(0, 0, 0, 0.2)`;
                    }
                    return `0 ${baseOffset * 1.2}px ${baseBlur * 1.2}px rgba(0, 0, 0, 0.2)`;
                  } else {
                    const shadowMultiplier = {
                      small: 1.0,
                      large: 1.2
                    };
                    const multiplier = shadowMultiplier[appearance.cardSize];
                    return `0 ${baseOffset * multiplier}px ${baseBlur * multiplier}px rgba(0, 0, 0, 0.2)`;
                  }
                })(),
                pointerEvents: 'auto',
                transform: infoPanelFading ? 'scale(1)' : 'scale(0.95)',
                transition: 'transform 0.6s ease-in-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flip-card-inner">
                {/* English Side - Translation */}
                <div className="flip-card-front" style={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #007AFF',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  lineHeight: '1.2',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: '#333',
                    textAlign: 'center',
                    marginBottom: 6,
                    marginTop: -4,
                    borderBottom: '2px solid #eee',
                    paddingBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span
                      onMouseEnter={() => {
                        console.log('🇫🇷 English word hover - switching to French side');
                        setCardSide('back');
                      }}
                      onMouseLeave={() => {
                        console.log('🇬🇧 English word hover end - switching back to English side');
                        setCardSide('front');
                      }}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {currentWordDetails?.translation || 'Dog'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🔊 Playing English word audio');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        opacity: 0.7
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Play audio"
                    >
                      🔊
                    </button>
                  </div>
                  
                  {/* English Grammar Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontWeight: 'bold', color: '#e53e3e', fontSize: '12px' }}>NOUN: </span>
                      <span style={{ fontSize: '12px' }}>A domesticated mammal, typically kept as a pet</span>
                    </div>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontWeight: 'bold', color: '#38a169', fontSize: '12px' }}>VERB: </span>
                      <span style={{ fontSize: '12px' }}>To follow persistently ("to dog someone's steps")</span>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#d69e2e', fontSize: '12px' }}>EXAMPLE: </span>
                        <span style={{ fontSize: '12px', fontStyle: 'italic' }}>The dog barked loudly at the stranger</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Add audio playback functionality
                          console.log('🔊 Playing English example audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          // Prevent card from closing when hovering over button
                          if (hoverTimeoutRef) {
                            clearTimeout(hoverTimeoutRef);
                            setHoverTimeoutRef(null);
                          }
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Play audio"
                      >
                        🔊
                      </button>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#00b5d8', fontSize: '12px' }}>PHRASAL: </span>
                        <span style={{ fontSize: '12px' }}>"dog out" - to dress up smartly</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔊 Playing English phrasal verb audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Play audio"
                      >
                        🔊
                      </button>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#dd6b20', fontSize: '12px' }}>IDIOM: </span>
                        <span style={{ fontSize: '12px' }}>"Every dog has its day" - everyone gets a chance</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔊 Playing English idiom audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Play audio"
                      >
                        🔊
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* French Side - Original Word */}
                <div className="flip-card-back" style={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #FF6B6B',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  lineHeight: '1.2',
                  overflow: 'hidden'
                }}>
                  {/* French Original Word */}
                  <div style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: '#333',
                    textAlign: 'center',
                    marginBottom: 6,
                    marginTop: -4,
                    borderBottom: '2px solid #eee',
                    paddingBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span
                      onMouseEnter={() => {
                        console.log('🇬🇧 French word hover - switching to English side');
                        setCardSide('front');
                      }}
                      onMouseLeave={() => {
                        console.log('🇫🇷 French word hover end - switching back to French side');
                        setCardSide('back');
                      }}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {currentWordDetails?.word || 'Chien'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🔊 Playing French word audio');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        opacity: 0.7
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Jouer l'audio"
                    >
                      🔊
                    </button>
                  </div>
                  
                  {/* French Grammar Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontWeight: 'bold', color: '#e53e3e', fontSize: '12px' }}>NOM: </span>
                      <span style={{ fontSize: '12px' }}>Un mammifère domestiqué, généralement gardé comme animal</span>
                    </div>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontWeight: 'bold', color: '#38a169', fontSize: '12px' }}>VERBE: </span>
                      <span style={{ fontSize: '12px' }}>Suivre quelqu'un de manière persistante</span>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#d69e2e', fontSize: '12px' }}>EXEMPLE: </span>
                        <span style={{ fontSize: '12px', fontStyle: 'italic' }}>Le chien aboie fort contre l'étranger</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Add audio playback functionality
                          console.log('🔊 Playing French example audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Jouer l'audio"
                      >
                        🔊
                      </button>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#00b5d8', fontSize: '12px' }}>EXPRESSION: </span>
                        <span style={{ fontSize: '12px' }}>"Comme un chien dans un jeu de quilles" - mal à l'aise</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔊 Playing French expression audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Jouer l'audio"
                      >
                        🔊
                      </button>
                    </div>
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#dd6b20', fontSize: '12px' }}>PROVERBE: </span>
                        <span style={{ fontSize: '12px' }}>"Chien qui aboie ne mord pas" - les menaces ne sont que du bluff</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔊 Playing French proverb audio');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Jouer l'audio"
                      >
                        🔊
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Top Controls - Language flags and close button */}
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 1000
              }}>
                {/* Language Switcher Flags */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <button
                    onClick={() => {
                      console.log('🇬🇧 English flag clicked - switching to front side');
                      console.log(`🗺 Current cardSide: ${cardSide}`);
                      setCardSide('front');
                      console.log('✅ setCardSide("front") called');
                    }}
                    style={{
                      background: 'none',
                      border: cardSide === 'front' ? '2px solid #007AFF' : '2px solid transparent',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      backgroundColor: cardSide === 'front' ? 'rgba(0, 122, 255, 0.1)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (cardSide !== 'front') {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.05)';
                        e.currentTarget.style.borderColor = '#007AFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (cardSide !== 'front') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                    title="Switch to English"
                  >
                    🇬🇧
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('🇫🇷 French flag clicked - switching to back side');
                      console.log(`🗺 Current cardSide: ${cardSide}`);
                      setCardSide('back');
                      console.log('✅ setCardSide("back") called');
                    }}
                    style={{
                      background: 'none',
                      border: cardSide === 'back' ? '2px solid #FF6B6B' : '2px solid transparent',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      backgroundColor: cardSide === 'back' ? 'rgba(255, 107, 107, 0.1)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (cardSide !== 'back') {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.05)';
                        e.currentTarget.style.borderColor = '#FF6B6B';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (cardSide !== 'back') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                    title="Switch to French"
                  >
                    🇫🇷
                  </button>
                </div>
                
                {/* Close button */}
                <button
                  onClick={() => {
                    console.log('✖️ Close button clicked - calling closeInfoPanel');
                    closeInfoPanel();
                  }}
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: '#666',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                    e.currentTarget.style.color = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }}
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Settings() {
  const { appearance, updateAppearance, syncFromEvent } = useSettings();
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [screenLayoutExpanded, setScreenLayoutExpanded] = useState(false);
  const [subjectsExpanded, setSubjectsExpanded] = useState(false);
  const [cardInfoExpanded, setCardInfoExpanded] = useState(false);
  const [speechExpanded, setSpeechExpanded] = useState(false);
  const [screenInfo, setScreenInfo] = useState({ width: 1920, height: 1080, cols: 4, rows: 3 });
  
  // Get screen info on mount and when grid settings change
  useEffect(() => {
    const getScreenInfo = async () => {
      try {
        const [width, height, cols, rows] = await invoke('get_screen_info', {
          autoDetectGrid: appearance.autoDetectGrid,
          manualGridCols: appearance.manualGridCols,
          manualGridRows: appearance.manualGridRows,
          manualScreenWidth: appearance.manualScreenWidth,
          manualScreenHeight: appearance.manualScreenHeight
        }) as [number, number, number, number];
        setScreenInfo({ width, height, cols, rows });
      } catch (error) {
        console.warn('Failed to get screen info:', error);
      }
    };
    
    getScreenInfo();
  }, [appearance.autoDetectGrid, appearance.manualGridCols, appearance.manualGridRows, appearance.manualScreenWidth, appearance.manualScreenHeight]);
  
  // Listen for settings updates  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    listen('settings-updated', (event) => {
      // @ts-ignore
      syncFromEvent(event.payload);
    }).then(un => { unsubscribe = un; });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [syncFromEvent]);
  
  // Close all panels when component unmounts (settings window closes)
  useEffect(() => {
    return () => {
      setAppearanceExpanded(false);
      setScreenLayoutExpanded(false);
      setSubjectsExpanded(false);
      setCardInfoExpanded(false);
      setSpeechExpanded(false);
    };
  }, []);
  
  const themeStyles = {
    backgroundColor: appearance.darkMode ? '#1a1a1a' : '#ffffff',
    color: appearance.darkMode ? '#ffffff' : '#000000',
    minHeight: '100vh',
    fontFamily: 'system-ui',
    overflowY: 'auto' as const, // Enable vertical scrolling
    overflowX: 'hidden' as const, // Hide horizontal scrolling
  };

  return (
    <div style={themeStyles}>
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 24 }}>Settings</h2>
        
        
        {/* Dark Mode - Always visible */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.darkMode}
              onChange={(e) => updateAppearance({ darkMode: e.target.checked })}
            />
            Dark Mode
          </label>
        </div>
        
        {/* Speech Recognition Section */}
        <div style={{ marginBottom: 32 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0',
              borderBottom: `1px solid ${appearance.darkMode ? '#333' : '#e0e0e0'}`,
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
            onClick={() => {
              setSpeechExpanded(!speechExpanded);
              if (!speechExpanded) {
                setAppearanceExpanded(false);
                setScreenLayoutExpanded(false);
                setSubjectsExpanded(false);
                setCardInfoExpanded(false);
              }
            }}
          >
            <span>🎤 Speech Recognition</span>
            <span 
              style={{
                transition: 'transform 0.2s ease',
                fontSize: '14px',
                color: appearance.darkMode ? '#999' : '#666',
                transform: speechExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
              }}
            >
              ▶
            </span>
          </div>
          
          {speechExpanded && (
            <div style={{ paddingLeft: '16px' }}>
              {/* Speech Recognition Enabled */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.speechRecognitionEnabled || false}
                    onChange={(e) => updateAppearance({ speechRecognitionEnabled: e.target.checked })}
                  />
                  Enable Speech Recognition
                </label>
                <div style={{ 
                  fontSize: '12px', 
                  color: appearance.darkMode ? '#999' : '#666',
                  marginTop: '4px',
                  marginLeft: '28px'
                }}>
                  Allow voice commands and speech-to-text input
                </div>
              </div>
              
              {/* Continuous Recognition */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.continuousRecognition || false}
                    onChange={(e) => updateAppearance({ continuousRecognition: e.target.checked })}
                    disabled={!appearance.speechRecognitionEnabled}
                  />
                  Continuous Recognition
                </label>
                <div style={{ 
                  fontSize: '12px', 
                  color: appearance.darkMode ? '#999' : '#666',
                  marginTop: '4px',
                  marginLeft: '28px'
                }}>
                  Keep listening for multiple commands (experimental)
                </div>
              </div>
              
              {/* Auto Language Detection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.autoSpeechLanguage || true}
                    onChange={(e) => updateAppearance({ autoSpeechLanguage: e.target.checked })}
                    disabled={!appearance.speechRecognitionEnabled}
                  />
                  Auto-detect Speech Language
                </label>
                <div style={{ 
                  fontSize: '12px', 
                  color: appearance.darkMode ? '#999' : '#666',
                  marginTop: '4px',
                  marginLeft: '28px'
                }}>
                  Use current language setting for speech recognition
                </div>
              </div>
              
              {/* Voice Commands Help */}
              <div style={{
                padding: '12px',
                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                borderRadius: 6,
                border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                marginBottom: 16
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: appearance.darkMode ? '#fff' : '#333'
                }}>
                  🎮 Available Voice Commands:
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: appearance.darkMode ? '#ccc' : '#666',
                  lineHeight: 1.5
                }}>
                  • "settings" - Open settings window<br/>
                  • "next" or "next word" - Show next content<br/>
                  • "favorites" - Toggle favorites menu<br/>
                  • "topics" - Toggle topics menu<br/>
                  • "quit" or "close" - Quit application<br/>
                  • Language names (e.g. "French", "Spanish") - Switch language<br/>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Subjects Section */}
        <div style={{ marginBottom: 32 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0',
              borderBottom: `1px solid ${appearance.darkMode ? '#333' : '#e0e0e0'}`,
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
            onClick={() => {
              setSubjectsExpanded(!subjectsExpanded);
              if (!subjectsExpanded) {
                setAppearanceExpanded(false);
                setScreenLayoutExpanded(false);
              }
            }}
          >
            <span>Subjects</span>
            <span 
              style={{
                transition: 'transform 0.2s ease',
                fontSize: '14px',
                color: appearance.darkMode ? '#999' : '#666',
                transform: subjectsExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
              }}
            >
              ▶
            </span>
          </div>
          
          {subjectsExpanded && (
            <>
              {/* Academic Subjects List */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '12px',
                marginBottom: 20 
              }}>
            
            {/* Languages Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🌍 Languages
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {[
                    { name: 'English', code: 'EN', icon: '🇬🇧' },
                    { name: 'Spanish', code: 'ES', icon: '🇪🇸' },
                    { name: 'French', code: 'FR', icon: '🇫🇷' },
                    { name: 'German', code: 'DE', icon: '🇩🇪' },
                    { name: 'Italian', code: 'IT', icon: '🇮🇹' },
                    { name: 'Portuguese', code: 'PT', icon: '🇵🇹' },
                    { name: 'Russian', code: 'RU', icon: '🇷🇺' },
                    { name: 'Japanese', code: 'JP', icon: '🇯🇵' },
                    { name: 'Korean', code: 'KR', icon: '🇰🇷' },
                    { name: 'Chinese (Simplified)', code: 'CN', icon: '🇨🇳' },
                    { name: 'Chinese (Traditional)', code: 'TW', icon: '🇨🇳' },
                    { name: 'Arabic', code: 'AR', icon: '🇸🇦' },
                    { name: 'Hindi', code: 'IN', icon: '🇮🇳' },
                    { name: 'Bengali', code: 'BN', icon: '🇧🇩' },
                    { name: 'Turkish', code: 'TR', icon: '🇹🇷' },
                    { name: 'Dutch', code: 'NL', icon: '🇳🇱' },
                    { name: 'Swedish', code: 'SE', icon: '🇸🇪' },
                    { name: 'Norwegian', code: 'NO', icon: '🇳🇴' },
                    { name: 'Danish', code: 'DK', icon: '🇩🇰' },
                    { name: 'Finnish', code: 'FI', icon: '🇫🇮' },
                    { name: 'Polish', code: 'PL', icon: '🇵🇱' },
                    { name: 'Czech', code: 'CZ', icon: '🇨🇿' },
                    { name: 'Hungarian', code: 'HU', icon: '🇭🇺' },
                    { name: 'Romanian', code: 'RO', icon: '🇷🇴' },
                    { name: 'Bulgarian', code: 'BG', icon: '🇧🇬' },
                    { name: 'Greek', code: 'GR', icon: '🇬🇷' },
                    { name: 'Hebrew', code: 'IL', icon: '🇮🇱' },
                    { name: 'Ukrainian', code: 'UA', icon: '🇺🇦' },
                    { name: 'Croatian', code: 'HR', icon: '🇭🇷' },
                    { name: 'Serbian', code: 'RS', icon: '🇷🇸' },
                    { name: 'Slovak', code: 'SK', icon: '🇸🇰' },
                    { name: 'Slovenian', code: 'SI', icon: '🇸🇮' },
                    { name: 'Estonian', code: 'EE', icon: '🇪🇪' },
                    { name: 'Latvian', code: 'LV', icon: '🇱🇻' },
                    { name: 'Lithuanian', code: 'LT', icon: '🇱🇹' },
                    { name: 'Vietnamese', code: 'VN', icon: '🇻🇳' },
                    { name: 'Thai', code: 'TH', icon: '🇹🇭' },
                    { name: 'Indonesian', code: 'ID', icon: '🇮🇩' },
                    { name: 'Malay', code: 'MY', icon: '🇲🇾' },
                    { name: 'Persian', code: 'IR', icon: '🇮🇷' },
                    { name: 'Urdu', code: 'PK', icon: '🇵🇰' },
                    { name: 'Georgian', code: 'GE', icon: '🇬🇪' },
                    { name: 'Armenian', code: 'AM', icon: '🇦🇲' },
                    { name: 'Albanian', code: 'AL', icon: '🇦🇱' },
                    { name: 'Macedonian', code: 'MK', icon: '🇲🇰' },
                    { name: 'Maltese', code: 'MT', icon: '🇲🇹' },
                    { name: 'Icelandic', code: 'IS', icon: '🇮🇸' },
                    { name: 'Irish', code: 'IE', icon: '🇮🇪' },
                    { name: 'Welsh', code: 'GB-WLS', icon: '🇬🇧' },
                    { name: 'Catalan', code: 'CAT', icon: '🇪🇸' },
                    { name: 'Basque', code: 'EUS', icon: '🇪🇸' },
                    { name: 'Swahili', code: 'SW', icon: '🇰🇪' },
                    { name: 'Amharic', code: 'AM-ET', icon: '🇪🇹' },
                    { name: 'Yoruba', code: 'YO', icon: '🇳🇬' },
                    { name: 'Zulu', code: 'ZU', icon: '🇿🇦' },
                    { name: 'Afrikaans', code: 'AF', icon: '🇿🇦' },
                    { name: 'Tagalog', code: 'TL', icon: '🇵🇭' },
                    { name: 'Cebuano', code: 'CEB', icon: '🇵🇭' },
                    { name: 'Hausa', code: 'HA', icon: '🇳🇬' },
                    { name: 'Igbo', code: 'IG', icon: '🇳🇬' },
                    { name: 'Xhosa', code: 'XH', icon: '🇿🇦' },
                    { name: 'Sesotho', code: 'ST', icon: '🇱🇸' },
                    { name: 'Esperanto', code: 'EO', icon: '🌍' },
                    { name: 'Latin', code: 'LA', icon: '🇮🇹' },
                    { name: 'Sanskrit', code: 'SA', icon: '🇮🇳' }
                  ].map((language) => (
                    <div key={language.code} style={{ marginBottom: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          onChange={(e) => console.log(`Install ${language.name} library:`, e.target.checked)}
                        />
                        <span>{language.icon}</span>
                        <span>{language.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </details>
            </div>
            
            {/* Mathematics Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🔢 Mathematics
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Mathematics content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Science Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🔬 Science
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Science content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* History Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🏛️ History
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  History content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Medicine Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  ⚕️ Medicine
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Medicine content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Law Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  ⚖️ Law
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Law content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Engineering Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  ⚙️ Engineering
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Engineering content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Architecture Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🏗️ Architecture
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Architecture content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Geography Dropdown */}
            <div style={{ marginBottom: 12 }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ 
                  padding: '8px 12px', 
                  backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                  borderRadius: 4,
                  border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🗺️ Geography
                </summary>
                <div style={{
                  marginTop: 8,
                  padding: '12px',
                  backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                  borderRadius: 6,
                  border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                  fontSize: 12,
                  color: appearance.darkMode ? '#999' : '#666'
                }}>
                  Geography content libraries will be available here.
                </div>
              </details>
            </div>
            
            {/* Other subjects with placeholder content */}
            {[
              { emoji: '⚛️', name: 'Physics' },
              { emoji: '⚗️', name: 'Chemistry' },
              { emoji: '🧬', name: 'Biology' },
              { emoji: '💻', name: 'Computer Science' },
              { emoji: '🧠', name: 'Psychology' },
              { emoji: '🤔', name: 'Philosophy' },
              { emoji: '📈', name: 'Economics' },
              { emoji: '💼', name: 'Business' },
              { emoji: '📚', name: 'Literature' },
              { emoji: '🎨', name: 'Art & Design' },
              { emoji: '🎵', name: 'Music' },
              { emoji: '🌌', name: 'Astronomy' },
              { emoji: '🌱', name: 'Environmental Science' },
              { emoji: '👥', name: 'Anthropology' },
              { emoji: '🏢', name: 'Sociology' },
              { emoji: '🗳️', name: 'Political Science' },
              { emoji: '📰', name: 'Journalism' },
              { emoji: '🎓', name: 'Education' },
              { emoji: '⛪', name: 'Theology' },
              { emoji: '🗣️', name: 'Linguistics' },
              { emoji: '📊', name: 'Statistics' },
              { emoji: '🌾', name: 'Agriculture' },
              { emoji: '🐕‍🦺', name: 'Veterinary Science' },
              { emoji: '🏺', name: 'Archaeology' },
              { emoji: '🪨', name: 'Geology' },
              { emoji: '🐙', name: 'Marine Biology' },
              { emoji: '🔍', name: 'Forensics' },
              { emoji: '💊', name: 'Pharmacology' },
              { emoji: '🥗', name: 'Nutrition' },
              { emoji: '🏃‍♂️', name: 'Sports Science' }
            ].map((subject) => (
              <div key={subject.name} style={{ marginBottom: 12 }}>
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ 
                    padding: '8px 12px', 
                    backgroundColor: appearance.darkMode ? '#333' : '#f0f0f0',
                    borderRadius: 4,
                    border: `1px solid ${appearance.darkMode ? '#555' : '#ddd'}`,
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    {subject.emoji} {subject.name}
                  </summary>
                  <div style={{
                    marginTop: 8,
                    padding: '12px',
                    backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                    borderRadius: 6,
                    border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                    fontSize: 12,
                    color: appearance.darkMode ? '#999' : '#666'
                  }}>
                    {subject.name} content libraries will be available here.
                  </div>
                </details>
              </div>
            ))}
            
          </div>
            </>
          )}
          
          {subjectsExpanded && (
            <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginTop: 4 }}>
              Select subjects to install and enable for studying. Each subject will have specialized content and features.
            </div>
          )}
        </div>
        
        {/* Appearance Section */}
        <div style={{ marginBottom: 32 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0',
              borderBottom: `1px solid ${appearance.darkMode ? '#333' : '#e0e0e0'}`,
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
            }} 
            onClick={() => {
              setAppearanceExpanded(!appearanceExpanded);
              if (!appearanceExpanded) {
                setScreenLayoutExpanded(false); // Close Screen Layout when opening Appearance
              }
            }}
          >
            <span>Appearance</span>
            <span 
              style={{
                transition: 'transform 0.2s ease',
                fontSize: '14px',
                color: appearance.darkMode ? '#999' : '#666',
                transform: appearanceExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
              }}
            >
              ▶
            </span>
          </div>
          {appearanceExpanded && (
            <div style={{ paddingTop: '16px' }}>
        
        {/* Font Size */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Font Size: {appearance.fontSize}px</label>
          <input 
            type="range" 
            min="40" 
            max="100" 
            value={appearance.fontSize}
            onChange={(e) => updateAppearance({ fontSize: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
        
        {/* Text Color */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Text Color</label>
          <input 
            type="color" 
            value={appearance.textColor}
            onChange={(e) => updateAppearance({ textColor: e.target.value })}
            style={{ width: '60px', height: '40px', border: 'none', borderRadius: '4px' }}
          />
        </div>
        
        {/* Font Weight */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.fontWeight === 'bold'}
              onChange={(e) => updateAppearance({ fontWeight: e.target.checked ? 'bold' : 'normal' })}
            />
            Bold Text
          </label>
        </div>
        
        
        {/* Color Rotation */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.colorRotation}
              onChange={(e) => updateAppearance({ colorRotation: e.target.checked })}
            />
            Auto Color Rotation
          </label>
        </div>
        
        {/* Card Transparency */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.cardTransparent}
              onChange={(e) => updateAppearance({ cardTransparent: e.target.checked })}
            />
            Transparent Card Background
          </label>
        </div>
        
        {/* Card Color (when not transparent) */}
        {!appearance.cardTransparent && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Card Background Color</label>
            <input 
              type="color" 
              value={appearance.cardColor.startsWith('#') ? appearance.cardColor : '#ffffff'}
              onChange={(e) => updateAppearance({ cardColor: e.target.value })}
              style={{ 
                width: '60px', 
                height: '40px', 
                border: '2px solid ' + (appearance.darkMode ? '#444' : '#ddd'), 
                borderRadius: '4px' 
              }}
            />
          </div>
        )}
        
        {/* Card Opacity (when transparent) */}
        {appearance.cardTransparent && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Card Opacity: {Math.round(appearance.cardOpacity * 100)}%</label>
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.01" 
              value={appearance.cardOpacity}
              onChange={(e) => updateAppearance({ cardOpacity: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        )}
        
        {/* Card Size Settings */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Card Size</label>
          
          {/* Auto Card Size Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input 
              type="checkbox" 
              checked={appearance.autoCardSize}
              onChange={(e) => updateAppearance({ autoCardSize: e.target.checked })}
            />
            Auto-size based on content
          </label>
          <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginBottom: 16, marginLeft: 24 }}>
            Small for short content, Large for longer sentences
          </div>
          
          {/* Manual Card Size Selector - only show if auto is off */}
          {!appearance.autoCardSize && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8, color: appearance.darkMode ? '#ccc' : '#333' }}>Choose default size:</div>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 12,
                padding: '12px 0'
              }}>
                {['small', 'large'].map((size) => (
                  <div 
                    key={size}
                    onClick={() => updateAppearance({ cardSize: size as any })}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <div style={{
                      width: size === 'small' ? 60 : 72,
                      height: size === 'small' ? 36 : 44,
                      backgroundColor: appearance.cardSize === size 
                        ? (appearance.darkMode ? '#0088ff' : '#007bff')
                        : (appearance.darkMode ? '#444' : '#ddd'),
                      border: appearance.cardSize === size
                        ? `2px solid ${appearance.darkMode ? '#00aaff' : '#0056b3'}`
                        : `1px solid ${appearance.darkMode ? '#666' : '#bbb'}`,
                      borderRadius: 4,
                      transition: 'all 0.2s ease',
                      transform: appearance.cardSize === size ? 'scale(1.05)' : 'scale(1)'
                    }} />
                    <span style={{
                      fontSize: 11,
                      color: appearance.cardSize === size
                        ? (appearance.darkMode ? '#00aaff' : '#007bff')
                        : (appearance.darkMode ? '#999' : '#666'),
                      fontWeight: appearance.cardSize === size ? 'bold' : 'normal',
                      textTransform: 'capitalize'
                    }}>{size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Font Family */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Font</label>
          <select 
            value={appearance.fontFamily}
            onChange={(e) => updateAppearance({ fontFamily: e.target.value })}
            style={{
              backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
              color: appearance.darkMode ? '#ffffff' : '#000000',
              border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '14px',
              width: '100%'
            }}
          >
            <option value="system-ui">System Default</option>
            <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">San Francisco / Segoe UI</option>
            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
            <option value="'Inter', -apple-system, sans-serif">Inter</option>
            <option value="'Roboto', -apple-system, sans-serif">Roboto</option>
            <option value="'Open Sans', -apple-system, sans-serif">Open Sans</option>
            <option value="Georgia, 'Times New Roman', serif">Georgia (Serif)</option>
            <option value="'Courier New', Courier, monospace">Courier New (Mono)</option>
            <option value="'Poppins', -apple-system, sans-serif">Poppins</option>
            <option value="'Montserrat', -apple-system, sans-serif">Montserrat</option>
          </select>
        </div>
        
        {/* Language Symbol Color Sync */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.syncSymbolColor}
              onChange={(e) => updateAppearance({ syncSymbolColor: e.target.checked })}
            />
            Sync Language Symbol Color
          </label>
        </div>
        
            </div>
          )}
        </div>
        
        {/* Card Info Section */}
        <div style={{ marginBottom: 32 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0',
              borderBottom: `1px solid ${appearance.darkMode ? '#333' : '#e0e0e0'}`,
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
            }} 
            onClick={() => {
              setCardInfoExpanded(!cardInfoExpanded);
              if (!cardInfoExpanded) {
                setAppearanceExpanded(false);
                setScreenLayoutExpanded(false);
              }
            }}
          >
            <span>Card Info</span>
            <span 
              style={{
                transition: 'transform 0.2s ease',
                fontSize: '14px',
                color: appearance.darkMode ? '#999' : '#666',
                transform: cardInfoExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
              }}
            >
              ▶
            </span>
          </div>
          {cardInfoExpanded && (
            <div style={{ paddingTop: '16px' }}>
              
              {/* Animation Type */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Animation Style</label>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  padding: '8px 0'
                }}>
                  {['flip', 'slide'].map((animation) => (
                    <label key={animation} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        type="radio" 
                        name="cardInfoAnimation" 
                        checked={appearance.cardInfoAnimation === animation}
                        onChange={() => updateAppearance({ cardInfoAnimation: animation as any })}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{animation}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Animation Direction */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Animation Direction</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  padding: '8px 0'
                }}>
                  {[
                    { value: 'left', label: '← Left', icon: '←' },
                    { value: 'right', label: 'Right →', icon: '→' },
                    { value: 'top', label: '↑ Top', icon: '↑' },
                    { value: 'bottom', label: 'Bottom ↓', icon: '↓' }
                  ].map((direction) => (
                    <label key={direction.value} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      border: `2px solid ${
                        appearance.cardInfoDirection === direction.value
                          ? (appearance.darkMode ? '#0088ff' : '#007bff')
                          : (appearance.darkMode ? '#444' : '#ddd')
                      }`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      backgroundColor: appearance.cardInfoDirection === direction.value
                        ? (appearance.darkMode ? '#0066cc' : '#e3f2fd')
                        : (appearance.darkMode ? '#2a2a2a' : '#fff'),
                      transition: 'all 0.2s ease'
                    }}>
                      <input 
                        type="radio" 
                        name="cardInfoDirection" 
                        checked={appearance.cardInfoDirection === direction.value}
                        onChange={() => updateAppearance({ cardInfoDirection: direction.value as any })}
                        style={{ margin: 0 }}
                      />
                      <span style={{ fontSize: '14px' }}>{direction.icon}</span>
                      <span style={{ fontSize: '12px' }}>{direction.label.replace(direction.icon, '').trim()}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Content Options */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 12, fontWeight: '600' }}>Show Information</label>
                
                {[
                  { key: 'cardInfoShowTranslation', label: 'Translation', icon: '🌐' },
                  { key: 'cardInfoShowDefinition', label: 'Definition', icon: '📖' },
                  { key: 'cardInfoShowPartOfSpeech', label: 'Part of Speech', icon: '📝' },
                  { key: 'cardInfoShowExamples', label: 'Examples', icon: '💬' },
                  { key: 'cardInfoShowPronunciation', label: 'Pronunciation', icon: '🔊' }
                ].map((option) => (
                  <label key={option.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                    padding: '8px 12px',
                    backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f8f9fa',
                    borderRadius: 6,
                    border: `1px solid ${appearance.darkMode ? '#444' : '#e0e0e0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = appearance.darkMode ? '#333' : '#e3f2fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = appearance.darkMode ? '#2a2a2a' : '#f8f9fa';
                  }}
                  >
                    <input 
                      type="checkbox" 
                      checked={appearance[option.key as keyof typeof appearance] as boolean}
                      onChange={(e) => updateAppearance({ [option.key]: e.target.checked })}
                    />
                    <span style={{ fontSize: '14px' }}>{option.icon}</span>
                    <span style={{ fontSize: '14px' }}>{option.label}</span>
                  </label>
                ))}
              </div>
              
              {/* Max Examples */}
              {appearance.cardInfoShowExamples && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>Max Examples: {appearance.cardInfoMaxExamples}</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    value={appearance.cardInfoMaxExamples}
                    onChange={(e) => updateAppearance({ cardInfoMaxExamples: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginTop: 4 }}>
                    Number of example sentences to show (1-5)
                  </div>
                </div>
              )}
              
              {/* Close Behavior */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 12, fontWeight: '600' }}>Close Behavior</label>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '8px 0'
                }}>
                  {[
                    { value: 'manual', label: 'Manual Only', description: 'Close only with X button' },
                    { value: 'mouse-leave', label: 'Auto Close', description: 'Close when mouse leaves card' },
                    { value: 'both', label: 'Both', description: 'Close with X button or mouse leave' }
                  ].map((option) => (
                    <label key={option.value} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '10px 12px',
                      backgroundColor: appearance.cardInfoCloseBehavior === option.value
                        ? (appearance.darkMode ? '#0066cc' : '#e3f2fd')
                        : (appearance.darkMode ? '#2a2a2a' : '#f8f9fa'),
                      borderRadius: 6,
                      border: `2px solid ${
                        appearance.cardInfoCloseBehavior === option.value
                          ? (appearance.darkMode ? '#0088ff' : '#007bff')
                          : (appearance.darkMode ? '#444' : '#e0e0e0')
                      }`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}>
                      <input 
                        type="radio" 
                        name="cardInfoCloseBehavior" 
                        checked={appearance.cardInfoCloseBehavior === option.value}
                        onChange={() => updateAppearance({ cardInfoCloseBehavior: option.value as any })}
                        style={{ margin: '2px 0 0 0' }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: 2 }}>{option.label}</div>
                        <div style={{ fontSize: '12px', color: appearance.darkMode ? '#999' : '#666' }}>{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
            </div>
          )}
        </div>
        
        {/* Screen Layout & Display Section */}
        <div style={{ marginBottom: 32 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '12px 0',
              borderBottom: `1px solid ${appearance.darkMode ? '#333' : '#e0e0e0'}`,
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
            }} 
            onClick={() => {
              setScreenLayoutExpanded(!screenLayoutExpanded);
              if (!screenLayoutExpanded) {
                setAppearanceExpanded(false); // Close Appearance when opening Screen Layout
              }
            }}
          >
            <span>Screen Layout & Display</span>
            <span 
              style={{
                transition: 'transform 0.2s ease',
                fontSize: '14px',
                color: appearance.darkMode ? '#999' : '#666',
                transform: screenLayoutExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
              }}
            >
              ▶
            </span>
          </div>
          {screenLayoutExpanded && (
            <div style={{ paddingTop: '16px' }}>
              {/* Multi-Space Settings */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.showOnAllSpaces}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      updateAppearance({ showOnAllSpaces: newValue });
                      try {
                        await invoke('update_window_spaces', { showOnAllSpaces: newValue });
                      } catch (error) {
                        console.warn('Failed to update window spaces:', error);
                      }
                    }}
                  />
                  Show on All Spaces (Mission Control)
                </label>
                <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginLeft: 24, marginTop: 4 }}>
                  Keep the flashcard visible across all desktop spaces and full-screen apps
                </div>
              </div>
              
              
              {/* Cross-Monitor Positioning */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.allowCrossMonitorPositioning}
                    onChange={(e) => updateAppearance({ allowCrossMonitorPositioning: e.target.checked })}
                  />
                  Allow Settings on Different Monitor
                </label>
                <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginLeft: 24, marginTop: 4 }}>
                  When enabled, settings window can open on a different monitor if there's not enough space
                </div>
              </div>
              
              {/* Monitor Preference for Flashcard */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Flashcard Monitor Preference</label>
                <select 
                  value={appearance.preferredMonitor}
                  onChange={(e) => updateAppearance({ preferredMonitor: e.target.value as any })}
                  style={{
                    backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
                    color: appearance.darkMode ? '#ffffff' : '#000000',
                    border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                    borderRadius: '4px',
                    padding: '6px 8px',
                    fontSize: '14px',
                    width: '100%'
                  }}
                >
                  <option value="auto">Auto (Use current monitor)</option>
                  <option value="primary">Always use primary monitor</option>
                  <option value="current">Stay on current monitor</option>
                  <option value="0">Monitor 1 (Built-in)</option>
                  <option value="1">Monitor 2 (External)</option>
                  <option value="2">Monitor 3 (Sidecar/External)</option>
                </select>
                <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginTop: 4 }}>
                  Choose which monitor the flashcard should appear on. Supports external monitors and iPad Sidecar.
                </div>
              </div>
        
              {/* Grid Detection Settings */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Screen Grid Detection</label>
                
                {/* Auto-detect option */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input 
                    type="radio" 
                    name="gridDetection" 
                    checked={appearance.autoDetectGrid}
                    onChange={() => updateAppearance({ autoDetectGrid: true })}
                  />
                  Auto-detect grid size
                </label>
                <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginBottom: 16, marginLeft: 24 }}>
                  Automatically determine grid size based on screen aspect ratio
                </div>
                
                {/* Manual option */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input 
                    type="radio" 
                    name="gridDetection" 
                    checked={!appearance.autoDetectGrid}
                    onChange={() => updateAppearance({ autoDetectGrid: false })}
                  />
                  Manual configuration
                </label>
                
                {/* Manual sub-options - only show if manual is selected */}
                {!appearance.autoDetectGrid && (
                  <div style={{ marginLeft: 24, marginBottom: 12 }}>
                    {/* Manual mode sub-options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="radio"
                          name="manualGridInputType"
                          checked={appearance.manualGridInputType === 'grid'}
                          onChange={() => updateAppearance({ manualGridInputType: 'grid' })}
                        />
                        Enter grid size manually
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="radio"
                          name="manualGridInputType"
                          checked={appearance.manualGridInputType === 'screen'}
                          onChange={() => updateAppearance({ manualGridInputType: 'screen' })}
                        />
                        Enter screen size manually
                      </label>
                    </div>

                    {/* Manual Grid Size - visible when manualGridInputType === 'grid' */}
                    {appearance.manualGridInputType === 'grid' && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Manual Grid Size</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Columns</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={appearance.manualGridCols}
                              onChange={(e) => updateAppearance({ manualGridCols: parseInt(e.target.value) || 4 })}
                              style={{
                                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
                                color: appearance.darkMode ? '#ffffff' : '#000000',
                                border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                                borderRadius: '4px',
                                padding: '6px 8px',
                                fontSize: '14px',
                                width: '60px'
                              }}
                            />
                          </div>
                          <span style={{ margin: '0 4px' }}>×</span>
                          <div>
                            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Rows</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={appearance.manualGridRows}
                              onChange={(e) => updateAppearance({ manualGridRows: parseInt(e.target.value) || 3 })}
                              style={{
                                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
                                color: appearance.darkMode ? '#ffffff' : '#000000',
                                border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                                borderRadius: '4px',
                                padding: '6px 8px',
                                fontSize: '14px',
                                width: '60px'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Manual Screen Size - visible when manualGridInputType === 'screen' */}
                    {appearance.manualGridInputType === 'screen' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Manual Screen Size</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: 11, marginBottom: 2, display: 'block', color: appearance.darkMode ? '#999' : '#666' }}>Width</label>
                            <input
                              type="number"
                              min="800"
                              max="7680"
                              step="1"
                              value={appearance.manualScreenWidth}
                              onChange={(e) => updateAppearance({ manualScreenWidth: parseInt(e.target.value) || 1920 })}
                              style={{
                                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
                                color: appearance.darkMode ? '#ffffff' : '#000000',
                                border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                                borderRadius: '4px',
                                padding: '6px 8px',
                                fontSize: '14px',
                                width: '80px'
                              }}
                            />
                          </div>
                          <span style={{ margin: '0 4px', marginTop: 14 }}>×</span>
                          <div>
                            <label style={{ fontSize: 11, marginBottom: 2, display: 'block', color: appearance.darkMode ? '#999' : '#666' }}>Height</label>
                            <input
                              type="number"
                              min="600"
                              max="4320"
                              step="1"
                              value={appearance.manualScreenHeight}
                              onChange={(e) => updateAppearance({ manualScreenHeight: parseInt(e.target.value) || 1080 })}
                              style={{
                                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f5f5f5',
                                color: appearance.darkMode ? '#ffffff' : '#000000',
                                border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                                borderRadius: '4px',
                                padding: '6px 8px',
                                fontSize: '14px',
                                width: '80px'
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: appearance.darkMode ? '#999' : '#666', marginTop: 4 }}>
                          Provide screen dimensions to derive the grid layout
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

        
        {/* Position Settings */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Window Position</h3>
          
          {/* Manual Position Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input 
              type="checkbox" 
              checked={appearance.manualPosition}
              onChange={(e) => updateAppearance({ manualPosition: e.target.checked })}
            />
            Remember Drag Position
          </label>
          <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginBottom: 12, marginLeft: 24 }}>
            Window will always open where you drag it
          </div>
          
          {/* Random Position Toggle - only show if not manual */}
          {!appearance.manualPosition && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input 
                type="checkbox" 
                checked={appearance.randomPosition}
                onChange={async (e) => {
                  const isRandom = e.target.checked;
                  updateAppearance({ randomPosition: isRandom });
                  
                  // Trigger immediate repositioning if random is enabled
                  if (isRandom) {
                    try {
                      await invoke('set_window_position', {
                        gridPosition: appearance.positionGrid,
                        randomPosition: true,
                        manualPosition: false,
                        manualX: appearance.manualX,
                        manualY: appearance.manualY,
                        autoDetectGrid: appearance.autoDetectGrid,
                        manualGridCols: appearance.manualGridCols,
                        manualGridRows: appearance.manualGridRows,
                        preferredMonitor: appearance.preferredMonitor.toString()
                      });
                    } catch (error) {
                      console.warn('Failed to set random position:', error);
                    }
                  }
                }}
              />
              Random Position
            </label>
          )}
          
          {/* Grid Position - only show if not random and not manual */}
          {!appearance.randomPosition && !appearance.manualPosition && (
            <div>
              <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginBottom: 8 }}>
                Screen: {screenInfo.width}x{screenInfo.height} ({screenInfo.cols}x{screenInfo.rows} grid)
                <button 
                  onClick={async () => {
                    try {
                      const positions = await invoke('debug_positions', {
                        autoDetectGrid: appearance.autoDetectGrid,
                        manualGridCols: appearance.manualGridCols,
                        manualGridRows: appearance.manualGridRows,
                        manualScreenWidth: appearance.manualScreenWidth,
                        manualScreenHeight: appearance.manualScreenHeight
                      }) as Array<[number, number, number]>;
                      console.log('All positions:', positions);
                    } catch (error) {
                      console.error('Debug failed:', error);
                    }
                  }}
                  style={{
                    marginLeft: 8,
                    padding: '2px 6px',
                    fontSize: 10,
                    border: '1px solid #ccc',
                    borderRadius: 3,
                    cursor: 'pointer',
                    backgroundColor: appearance.darkMode ? '#333' : '#fff',
                    color: appearance.darkMode ? '#fff' : '#000'
                  }}
                >
                  Debug
                </button>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${screenInfo.cols}, 1fr)`, 
                gap: 4, 
                maxWidth: Math.min(300, screenInfo.cols * 45),
                border: `1px solid ${appearance.darkMode ? '#444' : '#ddd'}`,
                borderRadius: 4,
                padding: 8,
                backgroundColor: appearance.darkMode ? '#2a2a2a' : '#f9f9f9'
              }}>
                {Array.from({ length: screenInfo.cols * screenInfo.rows }, (_, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      console.log('Grid position clicked:', index, 'Current position:', appearance.positionGrid);
                      updateAppearance({ positionGrid: index });
                      
                      // Also directly call the backend to ensure position updates immediately
                      // This works even when main window isn't actively running the position effect
                      try {
                        await invoke('set_window_position', {
                          gridPosition: index,
                          randomPosition: appearance.randomPosition || false,
                          manualPosition: appearance.manualPosition || false,
                          manualX: appearance.manualX || 100,
                          manualY: appearance.manualY || 100,
                          autoDetectGrid: appearance.autoDetectGrid ?? true,
                          manualGridCols: appearance.manualGridCols || 4,
                          manualGridRows: appearance.manualGridRows || 3,
                          preferredMonitor: (appearance.preferredMonitor || 'auto').toString()
                        });
                        console.log('Grid position applied successfully to main window');
                      } catch (error) {
                        console.error('Failed to apply grid position:', error);
                      }
                    }}
                    style={{
                      width: 40,
                      height: 30,
                      border: appearance.positionGrid === index 
                        ? `2px solid ${appearance.darkMode ? '#0088ff' : '#007bff'}` 
                        : `1px solid ${appearance.darkMode ? '#555' : '#ccc'}`,
                      backgroundColor: appearance.positionGrid === index
                        ? (appearance.darkMode ? '#0066cc' : '#e3f2fd')
                        : (appearance.darkMode ? '#333' : '#fff'),
                      borderRadius: 2,
                      cursor: 'pointer',
                      fontSize: 10,
                      color: appearance.positionGrid === index
                        ? (appearance.darkMode ? '#fff' : '#1976d2')
                        : (appearance.darkMode ? '#ccc' : '#666'),
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (appearance.positionGrid !== index) {
                        e.currentTarget.style.backgroundColor = appearance.darkMode ? '#444' : '#f0f0f0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (appearance.positionGrid !== index) {
                        e.currentTarget.style.backgroundColor = appearance.darkMode ? '#333' : '#fff';
                      }
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
            </div>
          )}
        </div>
        
        
      </div>
    </div>
  );
}

function App() {
  // Check if we're in settings window
  const urlParams = new URLSearchParams(window.location.search);
  const windowType = urlParams.get('window');
  
  if (windowType === 'settings') {
    return <Settings />;
  }
  
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<FlashCard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
