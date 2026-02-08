import React, { createContext, useState, useCallback } from 'react';

export const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const openCalendar = useCallback(() => setShowCalendar(true), []);
  const closeCalendar = useCallback(() => setShowCalendar(false), []);

  const openExerciseSelector = useCallback(() => setShowExerciseSelector(true), []);
  const closeExerciseSelector = useCallback(() => setShowExerciseSelector(false), []);

  const openExportModal = useCallback(() => setShowExportModal(true), []);
  const closeExportModal = useCallback(() => setShowExportModal(false), []);

  const value = {
    showCalendar,
    openCalendar,
    closeCalendar,
    showExerciseSelector,
    openExerciseSelector,
    closeExerciseSelector,
    showExportModal,
    openExportModal,
    closeExportModal,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within ModalProvider');
  }
  return context;
}
