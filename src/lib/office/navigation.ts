export type Point = [number, number];
export type Walkable = (x: number, y: number) => boolean;

/** Grid route excluding the origin. Null means unreachable, [] means arrived. */
export function gridRoute(start: Point, goal: Point, allowed: Walkable): Point[] | null {
  if (!allowed(...goal)) return null;
  const origin: Point = [Math.floor(start[0]), Math.floor(start[1])];
  const queue: Point[] = [origin];
  const previous = new Map<string, Point>();
  const seen = new Set([origin.join(',')]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    if (point[0] === goal[0] && point[1] === goal[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next: Point = [point[0] + dx, point[1] + dy];
      const key = next.join(',');
      if (!seen.has(key) && allowed(...next)) {
        seen.add(key);
        previous.set(key, point);
        queue.push(next);
      }
    }
  }
  if (!seen.has(goal.join(','))) return null;
  const result: Point[] = [];
  let point = goal;
  while (point.join(',') !== origin.join(',')) {
    result.unshift(point);
    point = previous.get(point.join(','))!;
  }
  return result;
}

/** A precise chair socket may only be approached after a valid floor route. */
export function seatRoute(start: Point, socket: Point, allowed: Walkable): Point[] | null {
  const cell: Point = [Math.floor(socket[0]), Math.floor(socket[1])];
  const route = gridRoute(start, cell, allowed);
  if (route === null) return null;
  if (cell[0] !== socket[0] || cell[1] !== socket[1]) route.push(socket);
  return route;
}

/** Curated eight-workstation Studio footprint, sampled at each floor-cell center. */
export function officeFloor(x: number, y: number): boolean {
  if (x < 1 || x > 22 || y < 5 || y > 20) return false;
  if (y >= 19 && x < 4) return false;
  if (y >= 20 && x > 19) return false;
  return true;
}

/** Feet and reserved next steps share the same clearance convention. */
export function clearOfPeople(point: Point, occupied: Point[], radius = .72): boolean {
  return occupied.every(other => Math.hypot(point[0] - other[0], point[1] - other[1]) >= radius);
}
