// AI-powered language learning types
export interface WordData {
  word: string;
  translation: string;
  part_of_speech: string;
  phonetic?: string;
  definition?: string;
  example_sentence?: string;
  difficulty_level?: string;
}

export interface WordDetailData {
  word: string;
  translation: string;
  part_of_speech: string;
  phonetic?: string;
  definition: string;
  etymology: string;
  example_sentences: string[];
  synonyms: string[];
  antonyms: string[];
  usage_notes: string;
  difficulty_level: string;
  frequency: string;
}

export interface LearningSession {
  words: WordData[];
  sentences: string[];
  phrasal_verbs: string[];
  language: string;
  topic: string;
  parts_of_speech: string[];
}

import * as CSS from 'csstype';

declare module 'react' {
  interface CSSProperties {
    WebkitUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    MozUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    msUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    WebkitUserDrag?: 'none' | 'auto' | 'element';
  }
}
