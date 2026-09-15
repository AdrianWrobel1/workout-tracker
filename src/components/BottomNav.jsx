import React from 'react';
import { BarChart3, Calendar, Home, Dumbbell, Settings } from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange }) => {
  // The 'profile' id is the stable internal tab key (tab order, restore
  // targets); only the visible label/icon now point at Statistics 2.0,
  // which is the tab's direct destination.
  const navItems = [
    { id: 'profile', icon: BarChart3, label: 'Statistics' },
    { id: 'history', icon: Calendar, label: 'History' },
    { id: 'home', icon: Home, label: 'Home', isCenter: true },
    { id: 'exercises', icon: Dumbbell, label: 'Exercises' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <nav className="bottom-navbar bg-zinc-950/90 backdrop-blur border-t border-white/10" aria-label="Main navigation">
      <div className="flex items-stretch justify-around h-16 px-2">
        {navItems.map((item) => {
          const { id, label, isCenter } = item;
          const IconComponent = item.icon;
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] transition-all duration-200 ease-out ${isCenter ? 'relative -mt-8' : 'relative'} ui-press`}
            >
              {isCenter ? (
                <>
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full ${
                      isActive
                        ? 'accent-bg shadow-lg ui-nav-icon-morph'
                        : 'bg-slate-700 hover:bg-slate-600'
                    } transition-all duration-200 border ${isActive ? 'accent-border-light' : 'border-white/10'}`}
                  >
                    <IconComponent size={26} color="white" strokeWidth={2.2} />
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-widest uppercase leading-none ${
                      isActive ? 'text-white' : 'text-slate-500'
                    } transition-colors duration-200`}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`flex items-center justify-center rounded-full px-3 py-1 transition-all duration-200 ${
                      isActive ? 'ui-active-pill ui-nav-icon-morph' : 'border border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <IconComponent size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                  </span>
                  <span
                    className={`text-[10px] font-semibold tracking-widest uppercase leading-none ${
                      isActive ? 'text-white' : 'text-slate-500'
                    } transition-colors duration-200`}
                  >
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
