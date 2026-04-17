export const scheduleLocalReminder = (title, body, dateTime) => {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  const now = Date.now();
  const target = new Date(dateTime).getTime();
  const delay = target - now;
  if (delay <= 0) return;
  const reminders = JSON.parse(localStorage.getItem('aegis_reminders') || '[]');
  const reminder = { id: Math.random().toString(36).slice(2), title, body, dateTime, created: now };
  reminders.push(reminder);
  localStorage.setItem('aegis_reminders', JSON.stringify(reminders));
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png', vibrate: [200, 100, 200], tag: 'aegis-' + reminder.id });
    }
    const stored = JSON.parse(localStorage.getItem('aegis_reminders') || '[]');
    localStorage.setItem('aegis_reminders', JSON.stringify(stored.filter(r => r.id !== reminder.id)));
  }, delay);
  return reminder.id;
};

export const restoreReminders = () => {
  if (typeof window === 'undefined') return;
  const reminders = JSON.parse(localStorage.getItem('aegis_reminders') || '[]');
  const now = Date.now();
  const active = reminders.filter(r => new Date(r.dateTime).getTime() > now);
  localStorage.setItem('aegis_reminders', JSON.stringify(active));
  active.forEach(r => {
    const delay = new Date(r.dateTime).getTime() - now;
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(r.title, { body: r.body, icon: '/icon-192.png', vibrate: [200, 100, 200] });
      }
      const stored = JSON.parse(localStorage.getItem('aegis_reminders') || '[]');
      localStorage.setItem('aegis_reminders', JSON.stringify(stored.filter(x => x.id !== r.id)));
    }, delay);
  });
};
