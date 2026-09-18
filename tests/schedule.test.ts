import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getSchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  reorderSchedule,
  resetSchedule,
  DEFAULT_SCHEDULE,
} from '@/lib/data/store';
import { GET as publicScheduleGet } from '@/app/api/schedule/route';
import {
  POST as adminSchedulePost,
  PUT as adminSchedulePut,
  DELETE as adminScheduleDelete,
} from '@/app/api/admin/schedule/route';
import { POST as adminScheduleResetPost } from '@/app/api/admin/schedule/reset/route';
import { getExpectedAdminCode } from '@/lib/auth/admin';

describe('Dynamic Event Timeline & Schedule Operations', () => {
  beforeEach(async () => {
    await resetSchedule();
  });

  it('retrieves empty default schedule (managed via admin panel)', async () => {
    const schedule = await getSchedule();
    expect(schedule.length).toBe(0);
    expect(Array.isArray(schedule)).toBe(true);
  });

  it('creates, updates, and deletes schedule items in store', async () => {
    const newItem = await createScheduleItem({
      time: '03:30 PM',
      title: 'MID-HACK SURPRISE EVENT',
      tag: 'SOCIAL',
      color: 'bg-nirmaan-purple',
    });

    expect(newItem.id).toBeDefined();
    expect(newItem.title).toBe('MID-HACK SURPRISE EVENT');
    expect(newItem.tag).toBe('SOCIAL');

    const scheduleAfterAdd = await getSchedule();
    expect(scheduleAfterAdd.length).toBe(1);

    // Update
    const updated = await updateScheduleItem(newItem.id, {
      title: 'UPDATED SURPRISE KEYNOTE',
      time: '04:00 PM',
    });
    expect(updated?.title).toBe('UPDATED SURPRISE KEYNOTE');
    expect(updated?.time).toBe('04:00 PM');

    // Delete
    const deleted = await deleteScheduleItem(newItem.id);
    expect(deleted).toBe(true);

    const scheduleAfterDelete = await getSchedule();
    expect(scheduleAfterDelete.length).toBe(0);
  });

  it('reorders schedule items correctly', async () => {
    // Create two items to reorder (schedule starts empty)
    const item1 = await createScheduleItem({ time: '09:00 AM', title: 'FIRST EVENT', tag: 'GENERAL', color: 'bg-nirmaan-blue' });
    const item2 = await createScheduleItem({ time: '10:00 AM', title: 'SECOND EVENT', tag: 'GENERAL', color: 'bg-nirmaan-green-bright' });

    // Swap first and second
    await reorderSchedule([
      { id: item1.id, order_index: 2 },
      { id: item2.id, order_index: 1 },
    ]);

    const updated = await getSchedule();
    expect(updated[0].id).toBe(item2.id);
    expect(updated[1].id).toBe(item1.id);
  });

  it('GET /api/schedule returns public schedule successfully', async () => {
    const res = await publicScheduleGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.schedule)).toBe(true);
    expect(data.schedule.length).toBe(0);
  });

  it('rejects unauthorized modifications to /api/admin/schedule with 401', async () => {
    // Unauthenticated POST
    const unauthPostReq = new NextRequest('http://localhost/api/admin/schedule', {
      method: 'POST',
      body: JSON.stringify({ time: '10:00 AM', title: 'TEST' }),
    });
    const postRes = await adminSchedulePost(unauthPostReq);
    expect(postRes.status).toBe(401);

    // Unauthenticated PUT
    const unauthPutReq = new NextRequest('http://localhost/api/admin/schedule', {
      method: 'PUT',
      body: JSON.stringify({ id: 'sch-1', title: 'HACKED' }),
    });
    const putRes = await adminSchedulePut(unauthPutReq);
    expect(putRes.status).toBe(401);

    // Unauthenticated DELETE
    const unauthDelReq = new NextRequest('http://localhost/api/admin/schedule?id=sch-1', {
      method: 'DELETE',
    });
    const delRes = await adminScheduleDelete(unauthDelReq);
    expect(delRes.status).toBe(401);

    // Unauthenticated RESET
    const unauthResetReq = new NextRequest('http://localhost/api/admin/schedule/reset', {
      method: 'POST',
    });
    const resetRes = await adminScheduleResetPost(unauthResetReq);
    expect(resetRes.status).toBe(401);
  });

  it('allows authorized modifications with valid admin credentials', async () => {
    const adminCode = getExpectedAdminCode();

    // Authenticated POST
    const authPostReq = new NextRequest('http://localhost/api/admin/schedule', {
      method: 'POST',
      headers: { 'x-admin-code': adminCode },
      body: JSON.stringify({
        time: '06:00 PM',
        title: 'LIGHTNING TALKS',
        tag: 'KEYNOTE',
        color: 'bg-nirmaan-orange',
      }),
    });
    const postRes = await adminSchedulePost(authPostReq);
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.item.title).toBe('LIGHTNING TALKS');

    // Authenticated Reset
    const authResetReq = new NextRequest('http://localhost/api/admin/schedule/reset', {
      method: 'POST',
      headers: { 'x-admin-code': adminCode },
    });
    const resetRes = await adminScheduleResetPost(authResetReq);
    expect(resetRes.status).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.success).toBe(true);
    expect(resetData.schedule.length).toBe(0);
  });
});
