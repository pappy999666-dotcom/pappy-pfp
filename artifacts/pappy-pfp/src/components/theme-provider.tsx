import React, { createContext, useContext, useState, useEffect } from 'react';

// Create a theme provider that forces dark mode since this app is dark-first.
const ThemeProviderContext = createContext({});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <ThemeProviderContext.Provider value={{}}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
