import { EstimatorProvider } from '@/lib/estimator/EstimatorContext';
import { EstimatorShell } from './EstimatorShell';
import { EstimatorErrorBoundary } from './EstimatorErrorBoundary';

export default function EstimatorPage() {
  return (
    <EstimatorErrorBoundary>
      <EstimatorProvider>
        <EstimatorShell />
      </EstimatorProvider>
    </EstimatorErrorBoundary>
  );
}
