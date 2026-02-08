import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MemberList } from "@/components/members/member-list";
import { FestivalList } from "@/components/festivals/festival-list";
import { getGroup } from "@/api/groups";
import { listGroupMembers } from "@/api/members";
import { listGroupFestivals } from "@/api/festivals";
import type { Group, Member, Festival } from "@/api/types";

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

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
        <h2 className="text-lg font-semibold">Members</h2>
        <MemberList members={members} />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Festivals</h2>
        <FestivalList festivals={festivals} />
      </section>
    </div>
  );
}
