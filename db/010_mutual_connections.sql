-- Календари стали «соединениями»: если A видит календарь B, то и B видит календарь A.
insert into calendar_members (calendar_id, user_id, role)
select oc.id, c.owner_id, 'editor'
from calendar_members m
join calendars c on c.id = m.calendar_id
join lateral (select id from calendars where owner_id = m.user_id order by created_at limit 1) oc on true
on conflict do nothing;
