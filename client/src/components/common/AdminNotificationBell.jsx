import React from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationBell, { openAlerts } from './NotificationBell';

export { openAlerts };

// Bell in the admin top bar: reports that need attention and pending access requests.
export default function AdminNotificationBell({ alerts, dark }) {
  const navigate = useNavigate();
  return (
    <NotificationBell alerts={alerts} dark={dark}
      emptyText="No urgent or overdue reports, and no pending requests."
      onSelect={(item, key) => navigate(key === 'accessRequests' ? '/admin/access-requests' : `/admin/submissions/${item.id}`)}
      links={[
        { label: 'All reports', onClick: () => navigate('/admin/submissions') },
        { label: 'Audit log', onClick: () => navigate('/admin/audit-log') },
      ]} />
  );
}
