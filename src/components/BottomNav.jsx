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
    <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 z-40 pb-safe">
      <div className="flex items-center justify-around h-20 px-2">
        {navItems.map(({ id, icon: Icon, label, isCenter }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
                className={`flex flex-col items-center justify-center transition-all duration-200 ease-out
                ${isCenter ? 'relative -mt-8' : ''}
                   ui-press`}
            >
              {isCenter ? (
                <div className={`flex items-center justify-center w-16 h-16 rounded-full
                  ${isActive ? 'bg-gradient-to-br from-accent to-accent shadow-2xl shadow-accent/50' : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'}
                  transition-all duration-200 border border-white/10`}>
                  <Icon size={32} color="white" strokeWidth={2.2} />
                </div>
              ) : (
                <>
                  <div className={`transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[9px] mt-1.5 font-semibold tracking-widest uppercase
                    ${isActive ? 'text-white opacity-100' : 'text-slate-500 opacity-0'}
                    transition-all duration-200`}>
                    {label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};