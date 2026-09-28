import { useState } from "react";
import Swal from "sweetalert2";
import { rpc } from "./supabaseClient";
import { displayDate, localDate } from "./lib/domain";

export default function GiftInventory({ items, admin, busy, run, notify }) {
  const [filter, setFilter] = useState("active");
  const visible = items.filter(
    (item) =>
      filter === "all" ||
      (filter === "active"
        ? !["Đã sử dụng", "Đã thu hồi"].includes(item.status)
        : item.status === "Đã sử dụng"),
  );
  const act = (item, action, date = null) =>
    run(async () => {
      await rpc("love_gift_action", {
        p_id: String(item.id),
        p_action: action,
        p_date: date,
      });
      await notify(
        `Quà “${item.prize_text}” vừa được cập nhật. Mở Love Game để xem lịch hẹn nhé!`,
      );
    });
  const schedule = async (item) => {
    const result = await Swal.fire({
      title: "Hẹn nhau ngày nào?",
      input: "date",
      inputValue: item.scheduled_for || localDate(),
      inputAttributes: { min: localDate(), "aria-label": "Ngày hẹn" },
      showCancelButton: true,
      confirmButtonText: "Lưu lịch hẹn",
      cancelButtonText: "Để sau",
      inputValidator: (date) =>
        !date || date < localDate()
          ? "Chọn hôm nay hoặc một ngày sắp tới nhé."
          : undefined,
    });
    if (result.isConfirmed) act(item, "schedule", result.value);
  };
  return (
    <section className="card stack">
      <div className="section-heading">
        <h3>Túi quà & lịch hẹn 🎁</h3>
        <label className="filter-label">
          Hiển thị
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="active">Đang có</option>
            <option value="used">Đã thực hiện</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Chọn quà → gửi lời hẹn → người thương chọn ngày → xác nhận đã thực hiện.
      </p>
      {!visible.length && (
        <p className="empty">
          Chưa có quà trong mục này. Những bất ngờ vẫn đang ở phía trước!
        </p>
      )}
      {visible.map((item) => (
        <article className="entry stack" key={item.id}>
          <div className="section-heading">
            <strong>{item.prize_text}</strong>
            <span className="pill">{item.status}</span>
          </div>
          <small className="muted">
            Nhận ngày {displayDate(item.created_at)}
            {item.scheduled_for
              ? ` · Hẹn ngày ${displayDate(item.scheduled_for)}`
              : ""}
          </small>
          <div className="actions">
            {!admin && item.status === "Chưa sử dụng" && (
              <button disabled={busy} onClick={() => act(item, "request")}>
                Mình muốn dùng quà 💌
              </button>
            )}
            {!admin && item.status === "Chờ hẹn" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(item, "cancel")}
              >
                Để dành lại
              </button>
            )}
            {admin && ["Chờ hẹn", "Đã hẹn"].includes(item.status) && (
              <button disabled={busy} onClick={() => schedule(item)}>
                {item.status === "Đã hẹn" ? "Đổi ngày hẹn" : "Chọn ngày hẹn"}
              </button>
            )}
            {admin && item.status === "Đã hẹn" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  const result = await Swal.fire({
                    title: "Hai đứa đã nhận quà cùng nhau?",
                    text: item.prize_text,
                    showCancelButton: true,
                    confirmButtonText: "Đã thực hiện",
                    cancelButtonText: "Chưa đâu",
                  });
                  if (result.isConfirmed) act(item, "complete");
                }}
              >
                Đã thực hiện ✓
              </button>
            )}
            {admin && !["Đã sử dụng", "Đã thu hồi"].includes(item.status) && (
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  const result = await Swal.fire({
                    title: "Thu hồi quà này?",
                    text: "Quà vẫn lưu trong lịch sử. Phiếu đã đổi không tự hoàn lại.",
                    showCancelButton: true,
                    confirmButtonText: "Thu hồi",
                    cancelButtonText: "Hủy",
                  });
                  if (result.isConfirmed) act(item, "revoke");
                }}
              >
                Thu hồi
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
