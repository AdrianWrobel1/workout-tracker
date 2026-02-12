import React, { createContext, useContext, useState, useCallback } from 'react';

export const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // View Navigation
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');
  const [returnTo, setReturnTo] = useState('home');

  // Exercise & Template Editing
  const [selectorMode, setSelectorMode] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);

  // Selections & Filters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [monthOffset, setMonthOffset] = useState(0);

  // Profile & Views
  const [profileSubview, setProfileSubview] = useState('main');

  // Input/Keypad
  const [activeInput, setActiveInput] = useState(null);
  const [keypadValue, setKeypadValue] = useState('');

  // Export Dialog
  const [exportType, setExportType] = useState('workouts');
  const [exportPeriod, setExportPeriod] = useState('last30');
  const [exportStartDate, setExportStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportEndDate, setExportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportExerciseId, setExportExerciseId] = useState(null);

  // Misc
  const [exerciseCreateSource, setExerciseCreateSource] = useState(null);
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  // --- VIEW NAVIGATION HANDLERS ---

  const handleViewChange = useCallback((newView) => {
    setView(newView);
  }, []);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    if (newTab === 'home') setView('home');
    else if (newTab === 'exercises') setView('exercises');
    else if (newTab === 'history') {
      setView('history');
      setHistoryFilter('all');
    }
    else if (newTab === 'profile') setView('profile');
  }, []);

  // --- EXERCISE SELECTOR ---

  const openExerciseSelector = useCallback((mode = 'activeWorkout') => {
    setSelectorMode(mode);
  }, []);

  const closeExerciseSelector = useCallback(() => {
    setSelectorMode(null);
  }, []);

  // --- EXERCISE EDITOR ---

  const openExerciseEditor = useCallback((exercise = null, source = null) => {
    setEditingExercise(exercise || { name: '', category: 'chest', defaultSets: [] });
    setExerciseCreateSource(source || null);
  }, []);

  const closeExerciseEditor = useCallback(() => {
    setEditingExercise(null);
  }, []);

  // --- TEMPLATE EDITOR ---

  const openTemplateEditor = useCallback((template = null) => {
    setEditingTemplate(template || { name: '', exercises: [] });
  }, []);

  const closeTemplateEditor = useCallback(() => {
    setEditingTemplate(null);
  }, []);

  // --- SELECTIONS ---

  const handleSelectExerciseId = useCallback((id) => {
    setSelectedExerciseId(id);
  }, []);

  const handleSelectDate = useCallback((date) => {
    setSelectedDate(date);
  }, []);

  const handleSelectExerciseIndex = useCallback((index) => {
    setSelectedExerciseIndex(index);
  }, []);

  // --- FILTERS ---

  const handleHistoryFilterChange = useCallback((filter) => {
    setHistoryFilter(filter);
  }, []);

  const handleMonthOffsetChange = useCallback((offset) => {
    setMonthOffset(offset);
  }, []);

  // --- PROFILE ---

  const handleProfileSubviewChange = useCallback((subview) => {
    setProfileSubview(subview);
  }, []);

  // --- KEYPAD HANDLERS ---

  const handleKeypadChange = useCallback((value) => {
    setKeypadValue(value);
  }, []);

  // --- EXPORT ---

  const handleExportTypeChange = useCallback((type) => {
    setExportType(type);
  }, []);

  const handleExportPeriodChange = useCallback((period) => {
    setExportPeriod(period);
  }, []);

  const handleExportStartDateChange = useCallback((date) => {
    setExportStartDate(date);
  }, []);

  const handleExportEndDateChange = useCallback((date) => {
    setExportEndDate(date);
  }, []);

  const handleExportExerciseIdChange = useCallback((id) => {
    setExportExerciseId(id);
  }, []);

  const value = {
    // View Navigation
    view,
    setView,
    activeTab,
    setActiveTab,
    returnTo,
    setReturnTo,
    handleViewChange,
    handleTabChange,

    // Exercise & Template Editing
    editingTemplate,
    setEditingTemplate,
    openTemplateEditor,
    closeTemplateEditor,
    editingExercise,
    setEditingExercise,
    openExerciseEditor,
    closeExerciseEditor,
    selectedExerciseIndex,
    setSelectedExerciseIndex,

    // Selectors
    selectorMode,
    setSelectorMode,
    openExerciseSelector,
    closeExerciseSelector,

    // Selections & Filters
    selectedDate,
    setSelectedDate,
    handleSelectDate,
    selectedExerciseId,
    setSelectedExerciseId,
    handleSelectExerciseId,
    historyFilter,
    setHistoryFilter,
    handleHistoryFilterChange,
    monthOffset,
    setMonthOffset,
    handleMonthOffsetChange,

    // Profile
    profileSubview,
    setProfileSubview,
    handleProfileSubviewChange,

    // Input/Keypad
    activeInput,
    setActiveInput,
    keypadValue,
    setKeypadValue,
    handleKeypadChange,

    // Export
    exportType,
    setExportType,
    handleExportTypeChange,
    exportPeriod,
    setExportPeriod,
    handleExportPeriodChange,
    exportStartDate,
    setExportStartDate,
    handleExportStartDateChange,
    exportEndDate,
    setExportEndDate,
    handleExportEndDateChange,
    exportExerciseId,
    setExportExerciseId,
    handleExportExerciseIdChange,

    // Misc
    exerciseCreateSource,
    setExerciseCreateSource,
    finishingWorkout,
    setFinishingWorkout,
    firstLoad,
    setFirstLoad,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};
