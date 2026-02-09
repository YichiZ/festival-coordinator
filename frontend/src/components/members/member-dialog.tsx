import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createMember, updateMember } from "@/api/members";
import type { Member } from "@/api/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  groupId: string;
  /** If provided, dialog is in edit mode */
  member?: Member;
}

export function MemberDialog({ open, onClose, onSaved, groupId, member }: Props) {
  const isEdit = !!member;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("active");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? "");
      setPhone(member?.phone ?? "");
      setCity(member?.city ?? "");
      setStatus(member?.status ?? "active");
      setSubmitting(false);
    }
  }, [open, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateMember(member.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          status,
        });
      } else {
        await createMember({
          group_id: groupId,
          name: name.trim(),
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          status,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save member:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Member" : "Add Member"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dlg-name">Name *</Label>
            <Input
              id="dlg-name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dlg-phone">Phone</Label>
            <Input
              id="dlg-phone"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dlg-city">City</Label>
            <Input
              id="dlg-city"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dlg-status">Status</Label>
            <select
              id="dlg-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? "Saving..." : isEdit ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
