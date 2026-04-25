"use client";

import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Trash2 } from "lucide-react";
import { updateUserPersonas } from "@/actions/user";
import { toast } from "sonner";

export default function PersonaManagement({ initialPersonas = [], onUpdate }) {
  const [personas, setPersonas] = useState(initialPersonas || []);
  const [isOpen, setIsOpen] = useState(false);

  const addPersona = () => {
    setPersonas([...personas, { name: "", bio: "", skills: "" }]);
  };

  const updatePersona = (index, field, value) => {
    const newPersonas = [...personas];
    newPersonas[index][field] = value;
    setPersonas(newPersonas);
  };

  const removePersona = (index) => {
    setPersonas(personas.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      await updateUserPersonas(personas);
      toast.success("Personas updated successfully");
      setIsOpen(false);
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to save personas");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Manage Personas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Career Personas</DialogTitle>
          <DialogDescription>
            Define different versions of yourself (e.g. App Dev, Blockchain Expert). 
            Our AI Agents will pick the best persona for each job application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {personas.map((persona, index) => (
            <div key={index} className="p-4 border rounded-xl bg-muted/30 relative space-y-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-2 h-8 w-8 text-red-500" 
                onClick={() => removePersona(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              <div className="space-y-2">
                <Label>Persona Name</Label>
                <Input 
                  placeholder="e.g. Senior Web Developer" 
                  value={persona.name} 
                  onChange={(e) => updatePersona(index, "name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Specialized Bio</Label>
                <Textarea 
                  placeholder="Write a brief specialized summary for this persona..." 
                  value={persona.bio}
                  onChange={(e) => updatePersona(index, "bio", e.target.value)}
                />
              </div>
            </div>
          ))}

          <Button variant="ghost" className="w-full border-dashed border-2 py-8" onClick={addPersona}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Persona
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} className="w-full sm:w-auto">Save Personas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
