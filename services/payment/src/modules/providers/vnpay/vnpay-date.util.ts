const VNPAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VNPAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function formatVnpayDate(date: Date): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}
