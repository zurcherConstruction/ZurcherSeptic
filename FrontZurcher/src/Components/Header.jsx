import React, { useState, useEffect, useRef } from "react";
import logo from "../../public/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logoutStaff } from "../Redux/Actions/authActions";
import Notifications from "./Notifications";
import { 
  FaBell, 
  FaSignOutAlt, 
  FaUser, 
  FaChevronDown,
  FaCog,
  FaUserCircle,
  FaClipboardList
} from "react-icons/fa";

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, currentStaff } = useSelector((state) => state.auth);
  const { notifications } = useSelector((state) => state.notifications);
  const { reminders } = useSelector((state) => state.reminders || { reminders: [] });

  const pendingReminders = reminders.filter(r => !r.myAssignment?.completed).length;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false); // 🆕 Para detectar nuevas notificaciones
  const previousUnreadCountRef = useRef(0); // 🆕 Para comparar cambios

  const handleLogout = () => {
    if (window.confirm("¿Estás seguro de que deseas cerrar sesión?")) {
      dispatch(logoutStaff());
      navigate("/");
    }
  };

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((notification) => !notification.isRead).length
    : 0;

  // 🆕 Detectar cambios en notificaciones no leídas
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current >= 0) {
      setHasNewNotification(true);
      
      // Detener la animación después de 10 segundos
      const timer = setTimeout(() => {
        setHasNewNotification(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner': return 'bg-gradient-to-r from-slate-400 to-slate-500';
      case 'admin': return 'bg-gradient-to-r from-purple-400 to-pink-500';
      case 'recept': return 'bg-gradient-to-r from-blue-400 to-cyan-500';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
  };

  return (
    <header className="bg-gradient-to-b from-gray-900 via-gray-850 to-gray-900 text-white border-b border-gray-900 shadow-lg fixed top-0 left-0 w-full z-50 backdrop-blur-sm bg-white/95">
      <div className="px-4 py-3 md:py-4 flex items-center justify-between">
        {/* Logo y nombre */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 focus:outline-none hover:opacity-80 transition-all duration-300 group"
          >
            <div className="relative">
              <img
                src={logo}
                alt="Logo"
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg md:text-xl font-bold text-gray-200 tracking-tight">
                ZURCHER CONSTRUCTION
              </h1>
              <p className="text-xs md:text-sm text-gray-500 font-medium">
                Construction Management
              </p>
            </div>
          </button>
        </div>

        {/* Panel de usuario */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 md:gap-4">
            {/* Recordatorios */}
            <div className="relative">
              <button
                onClick={() => navigate('/reminders-board')}
                title="Tablero de Tareas"
                className="relative p-2 md:p-3 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all duration-300 group border border-gray-600 hover:border-orange-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <FaClipboardList className="w-5 h-5 text-gray-300 group-hover:text-orange-400 transition-colors duration-300" />
                {pendingReminders > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold shadow-md">
                    {pendingReminders > 99 ? '99+' : pendingReminders}
                  </span>
                )}
              </button>
            </div>

            {/* Notificaciones */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false); // Cerrar menú de usuario si está abierto
                  setHasNewNotification(false); // Detener animación al abrir
                }}
                className="relative p-2 md:p-3 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all duration-300 group border border-gray-600 hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FaBell className={`w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors duration-300 ${hasNewNotification && unreadCount > 0 ? 'animate-shake' : ''}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold animate-pulse shadow-md">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
                  <div 
                    className="absolute right-4 top-16 w-80 md:w-96 max-h-96 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Notifications
                      isDropdown={true}
                      onClose={() => setShowNotifications(false)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Perfil de usuario */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false); // Cerrar notificaciones si están abiertas
                }}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200 hover:border-blue-300 hover:shadow-md group"
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base ${getRoleColor(currentStaff?.role)} shadow-md`}>
                  {currentStaff?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-32">
                    {currentStaff?.username || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {currentStaff?.role || 'Role'}
                  </p>
                </div>
                <FaChevronDown className={`w-3 h-3 text-gray-600 group-hover:text-blue-600 transition-all duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="fixed inset-0 z-50" onClick={() => setShowUserMenu(false)}>
                  <div 
                    className="absolute right-4 top-16 w-64 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header del menú */}
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${getRoleColor(currentStaff?.role)} shadow-md`}>
                          {currentStaff?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {currentStaff?.username || 'Usuario'}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {currentStaff?.role || 'Role'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Opciones del menú */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          navigate('/dashboard');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-300 text-left group"
                      >
                        <FaUser className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          Dashboard
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          navigate('/register');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-300 text-left group"
                      >
                        <FaCog className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          Settings
                        </span>
                      </button>

                      <hr className="my-2 border-gray-200" />

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-all duration-300 text-left group"
                      >
                        <FaSignOutAlt className="w-4 h-4 text-gray-500 group-hover:text-red-600" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-red-600">
                          Cerrar Sesión
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;