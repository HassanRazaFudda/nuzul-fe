import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createQueryClient } from './app/query-client';
import { createAppRouter } from './app/router';

import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

createRoot(container).render(
  <StrictMode>
    <App queryClient={queryClient} router={router} />
  </StrictMode>,
);
