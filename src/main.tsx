import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter-tight';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/landing.css';
import './styles/auth.css';
import './styles/studio.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App/>);
