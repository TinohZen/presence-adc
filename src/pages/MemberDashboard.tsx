import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MemberDashboard() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meetings');
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Mes Réunions</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg text-slate-800 mb-2 line-clamp-2">{meeting.title}</h3>
              <p className="text-slate-600 text-sm mb-4 flex-1 line-clamp-3">
                {meeting.description || 'Aucune description'}
              </p>
              
              <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={16} className="text-emerald-600" />
                  <span>{format(new Date(meeting.date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} className="text-emerald-600" />
                  <span>{meeting.time}</span>
                </div>
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
              Aucune réunion planifiée pour le moment.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
