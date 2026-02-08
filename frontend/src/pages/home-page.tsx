import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { GroupList } from "@/components/groups/group-list";
import { CreateGroupWizard } from "@/components/wizard/create-group-wizard";
import { listGroups } from "@/api/groups";
import type { Group } from "@/api/types";

export function HomePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchGroups = useCallback(() => {
    setLoading(true);
    listGroups()
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Groups</h1>
        <Button onClick={() => setWizardOpen(true)}>New Group</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <GroupList groups={groups} />
      )}

      <CreateGroupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={fetchGroups}
      />
    </div>
  );
}
