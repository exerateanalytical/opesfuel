import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx';
import { PdfPreviewHost } from './components/shared/PdfPreviewHost.tsx';
import { CurrencyProvider } from './i18n/CurrencyContext.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <CurrencyProvider>
        <App />
        <PdfPreviewHost />
      </CurrencyProvider>
    </LanguageProvider>
  </ErrorBoundary>
);
