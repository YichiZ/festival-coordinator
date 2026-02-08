import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepGroupName } from "./step-group-name";
import { StepAddMembers } from "./step-add-members";
import type { DraftMember } from "./step-add-members";
import { StepSelectFestivals } from "./step-select-festivals";
import { createGroup } from "@/api/groups";
import { createMember } from "@/api/members";
import { createFestival } from "@/api/festivals";
import { listFestivalCatalog } from "@/api/festival-catalog";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STEP_TITLES = ["Name your group", "Add members", "Select festivals"];

export function CreateGroupWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [selectedFestivalIds, setSelectedFestivalIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setGroupName("");
      setMembers([]);
      setSelectedFestivalIds([]);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const group = await createGroup(groupName);

      await Promise.all(
        members.map((m) =>
          createMember({
            group_id: group.id,
            name: m.name,
            phone: m.phone,
            ...(m.city ? { city: m.city } : {}),
          })
        )
      );

      if (selectedFestivalIds.length > 0) {
        const catalog = await listFestivalCatalog();
        const catalogMap = new Map(catalog.map((c) => [c.id, c]));

        await Promise.all(
          selectedFestivalIds.map((id) => {
            const entry = catalogMap.get(id);
            if (!entry) return Promise.resolve();
            return createFestival({
              group_id: group.id,
              name: entry.name,
              ...(entry.location ? { location: entry.location } : {}),
              ...(entry.dates_start ? { dates_start: entry.dates_start } : {}),
              ...(entry.dates_end ? { dates_end: entry.dates_end } : {}),
              ...(entry.ticket_price != null
                ? { ticket_price: entry.ticket_price }
                : {}),
              ...(entry.on_sale_date
                ? { on_sale_date: entry.on_sale_date }
                : {}),
              status: "considering",
            });
          })
        );
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <StepGroupName
            value={groupName}
            onChange={setGroupName}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepAddMembers
            members={members}
            onChange={setMembers}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepSelectFestivals
            selected={selectedFestivalIds}
            onChange={setSelectedFestivalIds}
            onSubmit={handleSubmit}
            onBack={() => setStep(1)}
            submitting={submitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
