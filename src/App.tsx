import { HashRouter, Route, Routes } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "./store/settings";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

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
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedPartsOfSpeech, setSelectedPartsOfSpeech] = useState<string[]>([]);
  const positionUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
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
  const regularTopics = sortedTopics.filter(topic => !isFavorite(topic.code));
  
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
  const regularContentTypes = sortedContentTypes.filter(contentType => !isContentTypeFavorite(contentType.code));
  
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
  const regularTopicsList = sortedTopicsList.filter(topic => !isTopicFavorite(topic.code));
  
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
    const initTimeout = setTimeout(() => {
      setIsInitialized(true);
      setTextVisible(true);
      setTimeout(() => {
        setFadeIn(true);
      }, 100);
    }, 200); // Brief delay to ensure clean start
    
    return () => clearTimeout(initTimeout);
  }, []);

  
  const testContent = [
    { text: "Cat", type: "word" },
    { text: "Dog", type: "word" },
    { text: "Bird", type: "word" },
    { text: "Fish", type: "word" },
    { text: "Tree", type: "word" }
  ];
  
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
  }, [isInitialized, currentContentIndex, appearance.colorRotation]); // Include dependencies
  
  // Topic menu stays open - only closes with X button
  // Removed auto-close behavior
  
  // Listen for settings updates from the settings window
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    listen('settings-updated', (event) => {
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
  
  // Update window size when content or card size settings change (debounced)
  useEffect(() => {
    // Only resize during content changes, not during manual size selection
    if (!isInitialized || isTransitioning || !textVisible || !fadeIn) {
      return;
    }
    
    const currentContent = testContent[currentContentIndex];
    
    // Calculate card size based on settings
    const cardSizes = {
      small: { width: 280, height: 160 },
      medium: { width: 380, height: 200 },
      large: { width: 520, height: 280 }
    };
    
    const getCardSize = (text: string) => {
      if (appearance.autoCardSize) {
        // Auto-select size based on content length
        if (text.length <= 15) {
          return cardSizes.small;
        } else if (text.length <= 45) {
          return cardSizes.medium;
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
      small: { width: 280, height: 160 },
      medium: { width: 380, height: 200 },
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
      try {
        await invoke('set_window_position', {
          gridPosition: appearance.positionGrid,
          randomPosition: appearance.randomPosition,
          manualPosition: appearance.manualPosition,
          manualX: appearance.manualX,
          manualY: appearance.manualY,
          autoDetectGrid: appearance.autoDetectGrid,
          manualGridCols: appearance.manualGridCols,
          manualGridRows: appearance.manualGridRows,
          preferredMonitor: appearance.preferredMonitor.toString()
        });
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
  
  const currentContent = testContent[currentContentIndex];
  
  return (
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
      pointerEvents: "none" // Make entire window click-through by default
    }}>
      <div 
        data-tauri-drag-region
        style={{
          pointerEvents: "auto", // Make card itself clickable for dragging
          width: (() => {
            const cardSizes = {
              small: { width: 280, height: 160 },
              medium: { width: 380, height: 200 },
              large: { width: 520, height: 280 }
            };
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 15) return cardSizes.small.width;
              if (currentContent.text.length <= 45) return cardSizes.medium.width;
              return cardSizes.large.width;
            }
            return cardSizes[appearance.cardSize].width;
          })(),
          height: (() => {
            const cardSizes = {
              small: { width: 280, height: 160 },
              medium: { width: 380, height: 200 },
              large: { width: 520, height: 280 }
            };
            if (appearance.autoCardSize) {
              if (currentContent.text.length <= 15) return cardSizes.small.height;
              if (currentContent.text.length <= 45) return cardSizes.medium.height;
              return cardSizes.large.height;
            }
            return cardSizes[appearance.cardSize].height;
          })(),
          backgroundColor: appearance.cardTransparent ? `rgba(255, 255, 255, ${appearance.cardOpacity})` : appearance.cardColor,
          borderRadius: 12, // Nice rounded corners
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)", // Beautiful shadow
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
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
            padding: "8px",
            position: "relative"
          }}
        >
          {/* Render text only when fully ready and initialized */}
          {isInitialized && textVisible && !isTransitioning && fadeIn ? (
            <span
              key={`clean-text-${renderKey}-${currentContentIndex}`}
              style={{
                fontSize: (() => {
                  // Scale font size with card size
                  const baseFontSize = appearance.fontSize;
                  if (appearance.autoCardSize) {
                    // Auto-sizing: font scales with content-based card size
                    if (currentContent.text.length <= 15) {
                      return baseFontSize * 0.8; // Small card = smaller font
                    } else if (currentContent.text.length <= 45) {
                      return baseFontSize; // Medium card = normal font
                    } else {
                      return baseFontSize * 1.2; // Large card = bigger font
                    }
                  } else {
                    // Manual sizing: font scales with selected card size
                    const cardSizeMultiplier = {
                      small: 0.8,
                      medium: 1.0,
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
                // Clean rendering
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale"
              }}
            >
              {currentContent.text}
            </span>
          ) : (
            // Force empty space during transitions to clear any remnants
            <span style={{ visibility: "hidden", fontSize: appearance.fontSize }}> </span>
          )}
        </div>
        
        {/* Topic Selector */}
        <div 
          className="topic-selector"
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            fontSize: 11, // Slightly smaller to fit both
            fontWeight: "600",
            opacity: 0.8,
            color: appearance.syncSymbolColor ? appearance.textColor : "inherit",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", // Always Helvetica
            cursor: "pointer",
            zIndex: 1000,
            pointerEvents: "auto", // Make topic selector clickable
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
            <div>
              {appearance.selectedTopicIcon || '🇫🇷'} [{appearance.selectedTopicCode || 'FR'}]
            </div>
          </div>
        </div>
        
        {/* Topic Menu with Three Columns - Positioned relative to card */}
        {showTopicMenu && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
              width: (() => {
                const cardSizes = {
                  small: { width: 280, height: 160 },
                  medium: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 15) return cardSizes.small.width;
                  if (currentContent.text.length <= 45) return cardSizes.medium.width;
                  return cardSizes.large.width;
                }
                return cardSizes[appearance.cardSize].width;
              })(),
              height: (() => {
                const cardSizes = {
                  small: { width: 280, height: 160 },
                  medium: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 15) return cardSizes.small.height;
                  if (currentContent.text.length <= 45) return cardSizes.medium.height;
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
                  borderBottom: '1px solid #e0e0e0',
                  position: 'relative'
                }}>
                  {/* Close Button */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTopicMenu(false);
                    }}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      fontWeight: '900',
                      color: '#000',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: 0.7
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    }}
                    title="Close menu"
                  >
                    ×
                  </div>
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
                      onClick={() => {
                        setShowTopicMenu(false);
                      }}
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
                      APPLY SETTINGS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        
        {/* Favorites Menu - Only show favorites */}
        {showFavoritesMenu && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
              width: (() => {
                const cardSizes = {
                  small: { width: 280, height: 160 },
                  medium: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 15) return cardSizes.small.width;
                  if (currentContent.text.length <= 45) return cardSizes.medium.width;
                  return cardSizes.large.width;
                }
                return cardSizes[appearance.cardSize].width;
              })(),
              height: (() => {
                const cardSizes = {
                  small: { width: 280, height: 160 },
                  medium: { width: 380, height: 200 },
                  large: { width: 520, height: 280 }
                };
                if (appearance.autoCardSize) {
                  if (currentContent.text.length <= 15) return cardSizes.small.height;
                  if (currentContent.text.length <= 45) return cardSizes.medium.height;
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
                  borderBottom: '1px solid #e0e0e0',
                  position: 'relative'
                }}>
                  {/* Close Button */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFavoritesMenu(false);
                    }}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      fontWeight: '900',
                      color: '#000',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: 0.7
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    }}
                    title="Close favorites"
                  >
                    ×
                  </div>
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
        
        {/* Icon Bar - Bottom Right */}
        <div style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          display: "flex",
          gap: 6,
          flexDirection: "row",
          alignItems: "center",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", // Always Helvetica for icons
          pointerEvents: "auto" // Make icon bar clickable
        }}>
          {/* Favorites Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: 14,
              color: "#ffa000", // Gold color for star
              opacity: 0.8,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
            onClick={() => {
              setShowFavoritesMenu(!showFavoritesMenu);
              setShowTopicMenu(false); // Close other menu
            }}
            title="Favorites"
          >
            ⭐
          </div>
          
          {/* Help Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: 14,
              color: "#000000", // Black color
              opacity: 0.8,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
            onClick={() => console.log('Help clicked')}
            title="Help"
          >
            ❔
          </div>
          
          {/* Mic Icon */}
          <div 
            style={{
              cursor: "pointer",
              fontSize: 14,
              opacity: 0.6,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
            onClick={() => console.log('Microphone clicked')}
            title="Microphone"
          >
            🎤
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
              fontSize: 16,
              opacity: 0.7,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            onClick={async () => {
              try {
                await invoke('show_settings_window');
              } catch (error) {
                console.warn('Failed to open settings:', error);
              }
            }}
            title="Settings"
          >
            ⚙️
          </div>
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const { appearance, updateAppearance, syncFromEvent } = useSettings();
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [screenLayoutExpanded, setScreenLayoutExpanded] = useState(false);
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
            Small for words, Medium for phrases, Large for sentences
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
                {['small', 'medium', 'large'].map((size) => (
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
                      width: size === 'small' ? 48 : size === 'medium' ? 60 : 72,
                      height: size === 'small' ? 28 : size === 'medium' ? 36 : 44,
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
        
        {/* Monitor Selection Section */}
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
          >
            <span>🖥️ Monitor & Display</span>
          </div>
          
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
        </div>
        
        {/* Screen Layout Section */}
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
            <span>Screen Layout</span>
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

              {/* Multi-Space Settings (macOS) */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={appearance.showOnAllSpaces}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      updateAppearance({ showOnAllSpaces: newValue });
                      // Call Tauri command to update window spaces
                      try {
                        await invoke('update_window_spaces', { 
                          showOnAllSpaces: newValue 
                        });
                      } catch (error) {
                        console.warn('Failed to update window spaces:', error);
                      }
                    }}
                  />
                  Show on All Spaces
                </label>
                <div style={{ fontSize: 12, color: appearance.darkMode ? '#999' : '#666', marginTop: 4, marginLeft: 24 }}>
                  Window appears on all macOS Desktops/Spaces
                </div>
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
                    onClick={() => updateAppearance({ positionGrid: index })}
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
