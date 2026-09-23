import React, { useEffect, useState } from 'react';
import CitizenNav from '../../components/common/CitizenNav';
import { SkeletonList } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(r => {
      setNotifications(r.data.notifications);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { toast.error('Failed to mark as read'); }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed'); }
  }

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <CitizenNav />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
            {unread > 0 && <p className="text-sm text-gray-500 mt-0.5">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead}
              className="px-4 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-blue-50 transition-colors font-medium">
              Mark All Read
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonList rows={5} avatar={false} />
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
            <Icon name="bell" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id}
                className={`bg-white rounded-xl border px-5 py-4 flex justify-between items-start gap-4 transition-colors ${
                  n.isRead ? 'border-gray-100' : 'border-blue-200 bg-blue-50'
                }`}>
                <div className="flex gap-3 items-start">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.isRead ? 'bg-gray-300' : 'bg-primary'}`} />
                  <div>
                    <p className="text-sm text-gray-800 font-medium">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)}
                    className="text-xs text-primary hover:underline flex-shrink-0 font-medium">
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
