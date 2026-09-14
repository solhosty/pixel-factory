import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { gridRoute, seatRoute, officeFloor, clearOfPeople } from '../navigation.ts';
const walls = new Set(['2,1','2,2','2,3']);
const allowed = (x,y) => x>=0&&x<5&&y>=0&&y<5&&!walls.has(`${x},${y}`);
test('walks around furniture using adjacent floor cells',()=>{
 const route=gridRoute([1,2],[3,2],allowed);
 assert.ok(route.length>2);
 let last=[1,2];
 for(const point of route){assert.ok(allowed(...point));assert.equal(Math.abs(last[0]-point[0])+Math.abs(last[1]-point[1]),1);last=point;}
 assert.deepEqual(route.at(-1),[3,2]);
});
test('unreachable chair never becomes a direct route through furniture',()=>{
 assert.equal(seatRoute([1,2],[2.5,2.2],allowed),null);
 const separated=(x,y)=>x>=0&&x<5&&y>=0&&y<5&&x!==2;
 assert.equal(seatRoute([1,2],[3.5,2.2],separated),null);
});
test('a reachable chair adds its precise socket only after the floor route',()=>{
 const route=seatRoute([1,2],[3.5,2.2],allowed);
 assert.deepEqual(route.at(-2),[3,2]);assert.deepEqual(route.at(-1),[3.5,2.2]);
});
test('arrived and unreachable routes are distinct',()=>{
 assert.deepEqual(gridRoute([1,2],[1,2],allowed),[]);
 assert.equal(gridRoute([1,2],[2,2],allowed),null);
});

test('stepped entrance excludes cut-away floor and stays reachable',()=>{
 assert.equal(officeFloor(2,18),false);
 assert.equal(officeFloor(17,19),false);
 const route=gridRoute([10,12],[9,19],officeFloor);
 assert.ok(route?.length);
 assert.ok(route.every(point=>officeFloor(...point)));
});

test('feet clearance prevents overlaps and accounts for reserved steps',()=>{
 assert.equal(clearOfPeople([4,5],[[4.4,5]]),false);
 assert.equal(clearOfPeople([4,5],[[4,6]]),true);
 assert.equal(clearOfPeople([4,5],[[5,5],[4,5]]),false);
});
