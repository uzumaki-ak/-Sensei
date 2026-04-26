import React from "react";
import Sidebar from "@/components/sidebar";
import AppTopbar from "@/components/app-topbar";

const MainLayout = async ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="app-main flex-1 transition-all duration-300 md:pl-72">
        <AppTopbar />
        <main className="pb-10 pt-4 md:pt-6">
          <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
