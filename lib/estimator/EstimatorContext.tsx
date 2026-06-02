'use client';

import React, {
  createContext, useContext, type ReactNode,
} from 'react';
import { useEstimator, type EstimatorActions } from './useEstimator';

const EstimatorContext = createContext<EstimatorActions | null>(null);

export function EstimatorProvider({ children }: { children: ReactNode }) {
  const estimator = useEstimator();
  return (
    <EstimatorContext.Provider value={estimator}>
      {children}
    </EstimatorContext.Provider>
  );
}

export function useEstimatorContext(): EstimatorActions {
  const ctx = useContext(EstimatorContext);
  if (!ctx) {
    throw new Error(
      'useEstimatorContext must be used inside <EstimatorProvider>'
    );
  }
  return ctx;
}
