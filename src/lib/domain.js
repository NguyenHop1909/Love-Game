export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function balanceOf(rows) {
  return rows.reduce(
    (sum, row) =>
      sum + Number(row.reward_amount || 0) - Number(row.penalty_amount || 0),
    0,
  );
}

export function nextRotation(previous, index, count) {
  if (!Number.isInteger(index) || count < 1 || index < 0 || index >= count)
    throw new Error("Kết quả vòng quay không hợp lệ.");
  const target = (360 - ((index + 0.5) * 360) / count) % 360;
  return previous + 360 * 6 + ((target - (previous % 360) + 360) % 360);
}

export function validQuizLink(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["kahoot.it", "kahoot.com"].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

export function displayDate(value) {
  return value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00+07:00` : value,
      ).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "Chưa hẹn";
}

export function memberRole(member) {
  return ["admin", "user"].includes(member?.role) ? member.role : null;
}
