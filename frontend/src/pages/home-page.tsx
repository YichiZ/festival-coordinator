import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { GroupList } from "@/components/groups/group-list";
import { CreateGroupWizard } from "@/components/wizard/create-group-wizard";
import { listGroups } from "@/api/groups";
import { useQuery } from "@/hooks/use-query";

export function HomePage() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: groups, loading, error, refetch } = useQuery("groups", listGroups);

  const handleCreated = useCallback(() => {
    setWizardOpen(false);
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Groups</h1>
        <Button onClick={() => setWizardOpen(true)}>New Group</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <GroupList groups={groups ?? []} />
      )}

      <CreateGroupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
