import React from "react";

export default function AdvancedLayout({ children }) {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* 
        This is the shared layout for all Advanced AI routes.
        It adds consistent padding and a subtle background effect.
      */}
      <div className="mx-auto w-full max-w-7xl">
        {children}
      </div>
    </div>
  );
}
