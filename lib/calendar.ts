import calendar from '@/data/hk-calendar.json';
export function hongKongCalendar(date: string) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const name = (calendar.holidays as Record<string, string>)[date];
  const known = calendar.years.includes(Number(date.slice(0, 4)));
  const label = name
    ? '香港公众假期 · ' + name
    : weekday === 0
      ? '星期日公众假期'
      : weekday === 6
        ? '周末 · 星期六'
        : known
          ? '香港工作日'
          : '香港假期日历待更新';
  return {
    label,
    isBusinessDay:
      name || weekday === 0 || weekday === 6 ? false : known ? true : null,
    source: calendar.source,
  };
}
