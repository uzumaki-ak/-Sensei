import JobsNav from "@/components/jobs-nav";

export default function JobsLayout({ children }) {
  return (
    <div className="px-4 md:px-8">
      <JobsNav />
      {children}
    </div>
  );
}
