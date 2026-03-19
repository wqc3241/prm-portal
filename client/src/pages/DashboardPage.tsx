import { useAuth } from '../hooks/useAuth';
import { PartnerDashboard } from './dashboard/PartnerDashboard';
import { CMDashboard } from './dashboard/CMDashboard';
import { AdminDashboard } from './dashboard/AdminDashboard';

export function DashboardPage() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'channel_manager':
      return <CMDashboard />;
    case 'partner_admin':
    case 'partner_rep':
    default:
      return <PartnerDashboard />;
  }
}
