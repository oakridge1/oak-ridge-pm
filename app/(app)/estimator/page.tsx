import { EstimatorProvider } from '@/lib/estimator/EstimatorContext';
import { EstimatorShell } from './EstimatorShell';
import { auth } from '@/auth';

export default async function EstimatorPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';
  return (
    <EstimatorProvider>
      <EstimatorShell isAdmin={isAdmin} />
    </EstimatorProvider>
  );
}
