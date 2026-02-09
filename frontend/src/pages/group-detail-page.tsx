import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MemberList } from "@/components/members/member-list";
import { MemberDialog } from "@/components/members/member-dialog";
import { FestivalList } from "@/components/festivals/festival-list";
import { getGroup } from "@/api/groups";
import { listGroupMembers, deleteMember } from "@/api/members";
import { listGroupFestivals } from "@/api/festivals";
import type { Group, Member, Festival } from "@/api/types";

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  // Member dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>(undefined);

  const fetchMembers = useCallback(() => {
    if (!id) return;
    listGroupMembers(id).then(setMembers);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getGroup(id), listGroupMembers(id), listGroupFestivals(id)])
      .then(([g, m, f]) => {
        setGroup(g);
        setMembers(m);
        setFestivals(f);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleAddMember() {
    setEditingMember(undefined);
    setDialogOpen(true);
  }

  function handleEditMember(member: Member) {
    setEditingMember(member);
    setDialogOpen(true);
  }

  async function handleDeleteMember(memberId: string) {
    try {
      await deleteMember(memberId);
      fetchMembers();
    } catch (err) {
      console.error("Failed to delete member:", err);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!group) {
    return <p className="text-muted-foreground">Group not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{group.name ?? "Unnamed Group"}</h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members</h2>
          <Button size="sm" variant="outline" onClick={handleAddMember}>
            <Plus className="h-4 w-4 mr-1" />
            Add Member
          </Button>
        </div>
        <MemberList
          members={members}
          onEdit={handleEditMember}
          onDelete={handleDeleteMember}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Festivals</h2>
        <FestivalList festivals={festivals} />
      </section>

      <MemberDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchMembers}
        groupId={id!}
        member={editingMember}
      />
    </div>
  );
}
