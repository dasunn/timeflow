import type { TaskWithRelations } from "@/lib/domain/types";

export interface LaidOutTask {
  task: TaskWithRelations;
  lane: number; // 0-based column within its overlap cluster
  lanes: number; // total columns in that cluster
}

// Side-by-side layout for overlapping tasks within a single day. Tasks are
// grouped into clusters of mutually-overlapping items; within a cluster each
// gets a lane, and all share the cluster's lane count so widths line up.
export function layoutDayTasks(tasks: TaskWithRelations[]): LaidOutTask[] {
  const sorted = [...tasks].sort(
    (a, b) =>
      a.plannedStart.getTime() - b.plannedStart.getTime() ||
      a.plannedEnd.getTime() - b.plannedEnd.getTime(),
  );

  const result: LaidOutTask[] = [];
  let cluster: { task: TaskWithRelations; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) {
      result.push({ task: c.task, lane: c.lane, lanes });
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const task of sorted) {
    const start = task.plannedStart.getTime();
    const end = task.plannedEnd.getTime();

    if (cluster.length > 0 && start >= clusterEnd) flush();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ task, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return result;
}
