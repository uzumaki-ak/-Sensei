"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateApplicationStatus } from "@/actions/jobs";
import { Suspense } from "react";
import JobCard from "@/components/job-card";
import PersonaManagement from "@/components/persona-management";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useJobsData } from "@/hooks/use-jobs-data";
import { Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = ["To Apply", "Applied", "Interviewing", "Offer", "Rejected"];

// Sortable Job Card Wrapper
function SortableJobCard({ app, onStatusChange, onRefresh, isGmailConnected, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCard
        app={app}
        onStatusChange={onStatusChange}
        onRefresh={onRefresh}
        isGmailConnected={isGmailConnected}
      />
    </div>
  );
}

// Column Component
function KanbanColumn({
  column,
  applications,
  onStatusChange,
  onRefresh,
  isGmailConnected,
  isOver,
}) {
  const { setNodeRef } = useSortable({
    id: column,
    data: { type: "column", column },
  });

  const columnApplications = applications.filter((app) => app.status === column);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[520px] min-w-[320px] max-w-[320px] flex-col gap-5 rounded-2xl border p-5 transition-colors ${
        isOver
          ? "border-primary bg-primary/5"
          : "border-muted/50 bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
            {column}
          </h3>
        </div>
        <Badge variant="outline" className="bg-background/50 font-mono">
          {columnApplications.length}
        </Badge>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        <SortableContext
          items={columnApplications.map((app) => app.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnApplications.length === 0 ? (
            <div className="mt-4 rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <p className="text-xs italic text-muted-foreground">
                Drop jobs here
              </p>
            </div>
          ) : (
            columnApplications.map((application) => (
              <SortableJobCard
                key={application.id}
                app={application}
                onStatusChange={onStatusChange}
                onRefresh={onRefresh}
                isGmailConnected={isGmailConnected}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function JobsKanbanContent() {
  const { applications, personas, isGmailConnected, loading, loadJobs, userId } =
    useJobsData();
  const [activeId, setActiveId] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const pipelineApplications = useMemo(
    () => applications.filter((application) => application.status !== "Discovered"),
    [applications]
  );

  const stats = useMemo(
    () => ({
      total: applications.length,
      toApply: applications.filter((app) => app.status === "To Apply").length,
      applied: applications.filter((app) => app.status === "Applied").length,
      interviewing: applications.filter((app) => app.status === "Interviewing").length,
      offers: applications.filter((app) => app.status === "Offer").length,
    }),
    [applications]
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    const app = pipelineApplications.find((a) => a.id === active.id);
    if (app) {
      setActiveColumn(app.status);
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;

    if (!over) return;

    const activeApp = pipelineApplications.find((a) => a.id === active.id);
    if (!activeApp) return;

    const overColumn = COLUMNS.includes(over.id) ? over.id : null;
    if (overColumn && activeApp.status !== overColumn) {
      // Visual feedback only - actual update happens on drag end
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveColumn(null);

    if (!over) return;

    const activeApp = pipelineApplications.find((a) => a.id === active.id);
    if (!activeApp) return;

    // Check if dropped on a column
    let newStatus = null;
    if (COLUMNS.includes(over.id)) {
      newStatus = over.id;
    } else {
      // Check if dropped on another card - get that card's column
      const overApp = pipelineApplications.find((a) => a.id === over.id);
      if (overApp) {
        newStatus = overApp.status;
      }
    }

    if (newStatus && newStatus !== activeApp.status) {
      setIsUpdating(true);
      try {
        await updateApplicationStatus(active.id, newStatus);
        await loadJobs();
        toast.success(`Moved to ${newStatus}`);
      } catch (error) {
        toast.error(error.message || "Failed to update status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const activeApp = activeId
    ? pipelineApplications.find((a) => a.id === activeId)
    : null;

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="animate-pulse text-muted-foreground">Loading Kanban board...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Application Kanban</h1>
          <p className="mb-4 text-muted-foreground">
            Drag and drop cards to move jobs between stages. Changes save automatically.
          </p>
          <PersonaManagement initialPersonas={personas} onUpdate={loadJobs} />
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Total</p>
              <p className="text-2xl font-black">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">To Apply</p>
              <p className="text-2xl font-black">{stats.toApply}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Applied</p>
              <p className="text-2xl font-black">{stats.applied}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Interviewing</p>
              <p className="text-2xl font-black text-blue-500">{stats.interviewing}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{stats.offers} offers</Badge>
        <Badge variant="outline">{pipelineApplications.length} active pipeline jobs</Badge>
        {isUpdating && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </Badge>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-10">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column}
              column={column}
              applications={pipelineApplications}
              onStatusChange={async (id, status) => {
                await updateApplicationStatus(id, status);
                await loadJobs(true);
              }}
              onRefresh={() => loadJobs(true)}
              isGmailConnected={isGmailConnected}
              isOver={activeColumn === column}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeApp ? (
            <div className="opacity-90 rotate-2 scale-105">
              <JobCard
                app={activeApp}
                onStatusChange={() => {}}
                onRefresh={() => {}}
                isGmailConnected={isGmailConnected}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default function JobsKanbanPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <JobsKanbanContent />
    </Suspense>
  );
}
