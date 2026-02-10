export function getOptOutDeadline(meetingDate: Date, daysBeforeDeadline: number = 5): Date {
  const deadline = new Date(meetingDate);
  deadline.setDate(deadline.getDate() - daysBeforeDeadline);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

export function isPastDeadline(meetingDate: Date, daysBeforeDeadline: number = 5): boolean {
  const deadline = getOptOutDeadline(meetingDate, daysBeforeDeadline);
  return new Date() > deadline;
}

export function formatDeadline(meetingDate: Date, daysBeforeDeadline: number = 5): string {
  const deadline = getOptOutDeadline(meetingDate, daysBeforeDeadline);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Denver',
  };
  return deadline.toLocaleString('en-US', options);
}

export function getAttendanceStatus(
  rsvpStatus: string,
  actuallyAttended: boolean | null,
  meetingDate: Date
): {
  label: string;
  color: string;
  icon: string;
} {
  const isPast = new Date() > new Date(meetingDate);

  if (rsvpStatus === 'not_attending') {
    return { label: 'Opted Out', color: 'bg-gray-500', icon: '🚫' };
  }

  if (actuallyAttended === true) {
    return { label: 'Attended', color: 'bg-green-500', icon: '✅' };
  }

  if (actuallyAttended === false) {
    return { label: 'No-Show', color: 'bg-red-500', icon: '❌' };
  }

  if (isPast) {
    return { label: 'Pending Review', color: 'bg-yellow-500', icon: '⏳' };
  }

  return { label: 'Attending', color: 'bg-blue-500', icon: '✅' };
}
