import * as CSS from 'csstype';

declare module 'react' {
  interface CSSProperties {
    WebkitUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    MozUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    msUserSelect?: 'none' | 'auto' | 'text' | 'contain' | 'all';
    WebkitUserDrag?: 'none' | 'auto' | 'element';
  }
}
