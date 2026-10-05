import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkeletonGate } from '../../components/common/Skeleton';
import ReportsMap from '../../components/common/ReportsMap';
import api from '../../utils/api';

// Every office's pinned reports (the staff Office Map shows one office's).
export default function MapView() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(api.get('/submissions?limit=500'))
      .then(r => {
        setSubmissions(r.data.submissions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gate]);

  return (
    <ReportsMap
      reports={submissions}
      loading={loading}
      title="Submission Map"
      emptyHint="Reports appear here when citizens pin the location on the Submit a Report page."
      reportHref={s => `/admin/submissions/${encodeURIComponent(s.id)}`}
      onOpenReport={s => navigate(`/admin/submissions/${s.id}`)}
    />
  );
}
