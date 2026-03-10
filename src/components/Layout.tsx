import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('adc_user');

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  const handleLogout = () => {
    localStorage.removeItem('adc_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-emerald-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-white text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
              ADC
            </div>
            <h1 className="font-semibold text-lg hidden sm:block">
            Association Devoir et Citoyen
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {user.photo_url ? (
              <img src={user.photo_url} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                <User size={16} />
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-emerald-600 rounded-full"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto p-8 w-full">
        <Outlet />
      </main>
    </div>
  );
}