import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/world.css';
import './styles/map.css';
import './styles/shell.css';
import './styles/studio.css';
import './styles/sirian.css';

createRoot(document.getElementById('root')!).render(<App />);
