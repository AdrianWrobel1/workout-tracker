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
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-40 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ id, icon: Icon, label, isCenter }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center transition-all duration-200 ease-out
                ${isCenter ? 'relative -mt-6' : ''}
                ${isActive ? 'text-white' : 'text-zinc-500'}
                hover:text-zinc-300 active:scale-95`}
            >
              {isCenter ? (
                <div className={`flex items-center justify-center w-14 h-14 rounded-full
                  ${isActive ? 'bg-zinc-800 shadow-lg border border-zinc-700' : 'bg-rose-500'}
                  transition-all duration-200`}>
                  <Icon size={28} color="white" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              ) : (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] mt-1 font-medium tracking-wide
                    ${isActive ? 'opacity-100' : 'opacity-0'}
                    transition-opacity duration-200`}>
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