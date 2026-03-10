import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MeetingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const userStr = localStorage.getItem('adc_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [meetingRes, attendanceRes] = await Promise.all([
        fetch('/api/meetings'),
        fetch(`/api/meetings/${id}/attendance`)
      ]);
      const meetingsData = await meetingRes.json();
      const currentMeeting = meetingsData.find((m: any) => m.id === Number(id));
      setMeeting(currentMeeting);

      const attendanceData = await attendanceRes.json();
      setAttendance(attendanceData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAttendance = async (userId: number, status: string) => {
    if (!isAdmin) return;
    try {
      await fetch(`/api/meetings/${id}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status }),
      });
      
      // Mettre à jour l'état local pour une meilleure réactivité
      setAttendance(attendance.map(a => 
        a.user_id === userId ? { ...a, status } : a
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const exportPDF = () => {
    if (!meeting) return;
    
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(18);
    doc.text('Association des Droits de Citoyen (ADC)', 14, 22);
    
    doc.setFontSize(14);
    doc.text('Liste de présence', 14, 32);
    
    // Détails de la réunion
    doc.setFontSize(11);
    doc.text(`Réunion: ${meeting.title}`, 14, 42);
    doc.text(`Date: ${format(new Date(meeting.date), 'dd MMMM yyyy', { locale: fr })} à ${meeting.time}`, 14, 48);
    
    // Tableau des présences
    const tableData = attendance.map((a, index) => [
      index + 1,
      `${a.last_name} ${a.first_name}`,
      a.phone,
      a.status === 'present' ? 'Présent(e)' : 'Absent(e)'
    ]);
    
    autoTable(doc, {
      startY: 55,
      head: [['N°', 'Nom & Prénom', 'Téléphone', 'Statut']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] }, // emerald-700
      styles: { fontSize: 10 },
      didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'Présent(e)') {
            data.cell.styles.textColor = [4, 120, 87]; // emerald-700
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
          }
        }
      }
    });
    
    // Résumé
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const finalY = (doc as any).lastAutoTable.finalY || 55;
    doc.text(`Total présents: ${presentCount} sur ${attendance.length}`, 14, finalY + 10);
    
    doc.save(`presence_adc_${format(new Date(meeting.date), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Chargement...</div>;
  if (!meeting) return <div className="text-center py-12 text-slate-500">Réunion introuvable.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 flex-1">{meeting.title}</h2>
        
        {isAdmin && (
          <button
            onClick={exportPDF}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exporter PDF</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Date et heure</h3>
            <p className="text-slate-800 font-medium">
              {format(new Date(meeting.date), 'EEEE d MMMM yyyy', { locale: fr })} à {meeting.time}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Description</h3>
            <p className="text-slate-800">{meeting.description || 'Aucune description'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Liste des présences</h3>
          <span className="text-sm font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
            {attendance.filter(a => a.status === 'present').length} / {attendance.length} présents
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 font-medium">Membre</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attendance.map((a) => (
                <tr key={a.user_id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {a.photo_url ? (
                        <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          {a.first_name[0]}{a.last_name[0]}
                        </div>
                      )}
                      <div className="font-medium text-slate-800">{a.first_name} {a.last_name}</div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {a.phone}
                  </td>
                  <td className="p-4 text-right">
                    {isAdmin ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdateAttendance(a.user_id, 'present')}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                            a.status === 'present' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Check size={16} className={a.status === 'present' ? 'text-emerald-600' : 'text-slate-400'} />
                          Présent
                        </button>
                        <button
                          onClick={() => handleUpdateAttendance(a.user_id, 'absent')}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                            a.status === 'absent' 
                              ? 'bg-red-100 text-red-800 border border-red-200' 
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <X size={16} className={a.status === 'absent' ? 'text-red-600' : 'text-slate-400'} />
                          Absent
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {a.status === 'present' ? 'Présent' : 'Absent'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    Aucun membre inscrit pour cette réunion.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
