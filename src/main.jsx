import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ModalProvider } from './contexts/ModalContext.jsx'
import { WorkoutProvider, UIProvider, SettingsProvider } from './contexts/index.js'
import './index.css' // Ważne!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ModalProvider>
        <WorkoutProvider>
          <UIProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </UIProvider>
        </WorkoutProvider>
      </ModalProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)