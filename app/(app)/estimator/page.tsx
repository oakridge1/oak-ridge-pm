import { EstimatorProvider } from '@/lib/estimator/EstimatorContext';
import { EstimatorShell } from './EstimatorShell';

export default function EstimatorPage() {
  return (
    <EstimatorProvider>
      <EstimatorShell />
    </EstimatorProvider>
  );
}
