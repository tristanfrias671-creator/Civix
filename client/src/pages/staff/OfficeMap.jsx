import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkeletonGate } from '../../components/common/Skeleton';
import ReportsMap from '../../components/common/ReportsMap';
import { deadlineInfo } from '../../components/common/DeadlineBadge';
import api from '../../utils/api';

// The staff member's own office's reports on the Cantilan map (the same map as the
// admin Map View). Opening a pin opens the report on Our Reports.
export default function OfficeMap() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(api.get('/staff/portal/map'))
      .then(r => {
        setSubmissions(r.data.submissions || []);
        setDepartment(r.data.department || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gate]);

  return (
    <ReportsMap
      reports={submissions}
      loading={loading}
      title="Office Map"
      subtitle={`Reports sent to ${department || 'your office'}.`}
      emptyHint="Reports appear here when citizens pin the location on the Submit a Report page."
      openLabel="Open report"
      popupTitle={s => (s.department === 'UNASSIGNED' ? 'No office yet' : deadlineInfo(s)?.label || 'No deadline')}
      reportHref={() => '/staff/submissions'}
      onOpenReport={s => navigate('/staff/submissions', { state: { openId: s.id } })}
    />
  );
}
