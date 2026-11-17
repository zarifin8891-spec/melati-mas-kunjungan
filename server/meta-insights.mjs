const DAY = 86400000;
const isoDay = value => new Date(value).toISOString().slice(0, 10);
const pacific = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
const offset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', timeZoneName: 'longOffset'
});

function pacificMidnight(day) {
  const zone = offset.formatToParts(new Date(day + 'T12:00:00Z'))
    .find(part => part.type === 'timeZoneName').value.slice(3);
  return Date.parse(day + 'T00:00:00' + zone);
}

export function lastCompletedWeek(now) {
  const parts = Object.fromEntries(pacific.formatToParts(now).map(p => [p.type, p.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  const end = today - daysSinceMonday * DAY;
  const startDate = isoDay(end - 7 * DAY);
  const endDate = isoDay(end);
  return {
    startDate, endDate, lastDate: isoDay(end - DAY),
    from: pacificMidnight(startDate), to: pacificMidnight(endDate),
    facebookUntil: pacificMidnight(isoDay(end + DAY))
  };
}

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export async function readWeeklyInsights({ readGraph, pageId, instagramId, now }) {
  const week = lastCompletedWeek(now);
  const since = String(week.from / 1000);
  const requests = [
    {
      platform: 'Facebook', metric: 'page_total_media_view_unique', id: pageId,
      params: { period: 'week', since, until: String(week.facebookUntil / 1000) },
      extract: item => item?.values?.find(value => Date.parse(value.end_time) === week.to)?.value
    },
    {
      platform: 'Instagram', metric: 'reach', id: instagramId,
      params: { period: 'day', metric_type: 'total_value', since, until: String(week.to / 1000) },
      extract: item => item?.total_value?.value
    }
  ];

  const metrics = await Promise.all(requests.map(async ({ platform, metric, id, params, extract }) => {
    try {
      const response = await readGraph(id + '/insights', { metric, ...params });
      if (!Array.isArray(response.data)) return { platform, metric, status: 'unavailable', value: null };
      const value = count(extract(response.data.find(item => item.name === metric)));
      return { platform, metric, status: value === null ? 'no_data' : 'available', value };
    } catch (error) {
      if (error.message === 'meta_reconnect_required') throw error;
      return { platform, metric, status: 'unavailable', value: null };
    }
  }));

  return {
    source: 'Meta Graph API', timezone: 'America/Los_Angeles',
    start_date: week.startDate, end_date: week.lastDate, metrics
  };
}
