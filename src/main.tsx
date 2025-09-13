import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Prevent duplicate rendering by tracking root creation
let isRenderingStarted = false;

if (!isRenderingStarted) {
  isRenderingStarted = true;
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(<App />);
}
