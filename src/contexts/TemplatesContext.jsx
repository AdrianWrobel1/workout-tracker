import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getActivePlanForTemplate } from '../domain/templatePlans.js';

// eslint-disable-next-line react-refresh/only-export-components
export const TemplatesContext = createContext();

export const TemplatesProvider = ({ children, templates: externalTemplates, setTemplates: externalSetTemplates }) => {
  const [internalTemplates, setInternalTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('workout_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedTemplatePlan, setSelectedTemplatePlan] = useState(() => {
    try {
      const saved = localStorage.getItem('selected_template_plan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const templates = externalTemplates ?? internalTemplates;
  const setTemplates = externalSetTemplates ?? setInternalTemplates;
  const usesExternalTemplates = typeof externalSetTemplates === 'function';

  // Persist templates
  useEffect(() => {
    if (usesExternalTemplates) return;
    localStorage.setItem('workout_templates', JSON.stringify(templates));
  }, [templates, usesExternalTemplates]);

  // Persist selected plan
  useEffect(() => {
    if (selectedTemplatePlan) {
      localStorage.setItem('selected_template_plan', JSON.stringify(selectedTemplatePlan));
    } else {
      localStorage.removeItem('selected_template_plan');
    }
  }, [selectedTemplatePlan]);

  const updateTemplate = useCallback((updatedTemplate) => {
    setTemplates(prev => prev.map(t => (t.id === updatedTemplate.id ? updatedTemplate : t)));
  }, [setTemplates]);

  const selectPlanForTemplate = useCallback((templateId, plan) => {
    setSelectedTemplatePlan({
      templateId,
      plan,
      selectedAt: new Date().toISOString()
    });

    setTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;
      return {
        ...t,
        defaultPlanId: plan?.id ?? null
      };
    }));
  }, [setTemplates]);

  const getActivePlan = useCallback((templateId) => {
    if (selectedTemplatePlan?.templateId === templateId) {
      return selectedTemplatePlan.plan ?? null;
    }

    const template = templates.find(t => t.id === templateId);
    return template ? getActivePlanForTemplate(template) : null;
  }, [templates, selectedTemplatePlan]);

  const value = useMemo(() => ({
    templates,
    setTemplates,
    updateTemplate,
    selectedTemplatePlan,
    selectPlanForTemplate,
    getActivePlan
  }), [templates, setTemplates, updateTemplate, selectedTemplatePlan, selectPlanForTemplate, getActivePlan]);

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
};
