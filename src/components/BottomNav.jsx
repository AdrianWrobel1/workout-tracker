import React from 'react';
import { User, Calendar, Home, Dumbbell, Settings } from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'history', icon: Calendar, label: 'History' },
    { id: 'home', icon: Home, label: 'Home', isCenter: true },
    { id: 'exercises', icon: Dumbbell, label: 'Exercises' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <nav className="bottom-navbar bg-black/95 border-t border-white/10">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const { id, label, isCenter } = item;
          const IconComponent = item.icon;
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center transition-all duration-200 ease-out ${isCenter ? 'relative -mt-8' : 'relative'} ui-press`}
            >
              {isCenter ? (
                <div
                  className={`flex items-center justify-center w-16 h-16 rounded-full ${
                    isActive
                      ? 'bg-gradient-to-br from-accent to-accent shadow-2xl shadow-accent/50 ui-nav-icon-morph'
                      : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'
                  } transition-all duration-200 border border-white/10`}
                >
                  <IconComponent size={32} color="white" strokeWidth={2.2} />
                </div>
              ) : (
                <>
                  <div className={`transition-all duration-200 ${isActive ? 'text-white ui-nav-icon-morph' : 'text-slate-400 hover:text-slate-300'}`}>
                    <IconComponent size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span
                    className={`text-[9px] mt-1.5 font-semibold tracking-widest uppercase ${
                      isActive ? 'text-white opacity-100' : 'text-slate-500 opacity-0'
                    } transition-all duration-200`}
                  >
                    {label}
                  </span>
                </>
              )}

              <span
                className={`absolute -bottom-1.5 h-0.5 rounded-full bg-accent transition-all duration-220 ease-out ${
                  isActive ? 'w-6 opacity-100 ui-bottomnav-indicator' : 'w-0 opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

