import React from "react";
import Sidebar from "@/components/sidebar";

const MainLayout = async ({ children }) => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:pl-64">
        <div className="container mx-auto mt-24 mb-20">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
