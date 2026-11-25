import '../tokens/index.css';
import '../components/components.css';
import './library.css';
import { createRoot } from 'react-dom/client';
import { Library } from './app.tsx';

const container = document.getElementById('root');
if (container) createRoot(container).render(<Library />);
