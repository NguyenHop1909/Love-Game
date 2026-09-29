export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function balanceOf(rows) {
  const raw = rows.reduce(
    (sum, row) =>
      sum + Number(row.reward_amount || 0) - Number(row.penalty_amount || 0),
    0,
  );
  // Couple rule: an exact raw balance of 9 is treated as 10 for redemption.
  return raw === 9 ? 10 : raw;
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

const auditActions = {
  INSERT: "Đã thêm",
  UPDATE: "Đã chỉnh sửa",
  DELETE: "Đã xóa",
};

function ticketSummary(row) {
  if (!row) return "một dòng điểm";
  const reward = Number(row.reward_amount || 0);
  const penalty = Number(row.penalty_amount || 0);
  const reason = row.reward_reason || row.penalty_reason;
  const parts = [];
  if (reward) parts.push(`${reward.toLocaleString("vi-VN")} phiếu thưởng`);
  if (penalty) parts.push(`${penalty.toLocaleString("vi-VN")} phiếu phạt`);
  if (!parts.length) parts.push("0 phiếu");
  return `${parts.join(" và ")}${reason ? ` · Lý do: ${reason}` : ""}`;
}

export function formatAuditLog(log) {
  const action = auditActions[log?.action_type] || log?.action_type || "Thay đổi";
  try {
    const details = JSON.parse(log.action_details);
    const before = details.before;
    const after = details.after;
    if (details.table === "rewards_penalties") {
      if (log.action_type === "INSERT") return `${action} ${ticketSummary(after)}`;
      if (log.action_type === "DELETE") return `${action} ${ticketSummary(before)}`;
      return `${action} điểm: ${ticketSummary(before)} → ${ticketSummary(after)}`;
    }
    if (details.table === "quizzes") {
      const row = after || before;
      return `${action} nhiệm vụ${row?.link_kahoot ? ` · ${row.link_kahoot}` : ""}`;
    }
    if (details.table === "user_inventory") {
      const row = after || before;
      return `${action} quà${row?.prize_text ? ` · ${row.prize_text}` : ""}`;
    }
    if (details.table === "wheel_settings") return `${action} cấu hình vòng quay`;
    return `${action} dữ liệu`;
  } catch {
    return log?.action_details || action;
  }
}
