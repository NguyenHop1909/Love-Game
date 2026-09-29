import { useState } from "react";
import Swal from "sweetalert2";
import { supabase, rpc } from "./supabaseClient";
import { displayDate, localDate } from "./lib/domain";

export default function SharedSpace({
  entries,
  members,
  userId,
  run,
  busy,
  notify,
}) {
  const [kind, setKind] = useState("mood");
  const [pick, setPick] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [editingMood, setEditingMood] = useState(null);
  const name = (id) =>
    members.find((m) => m.user_id === id)?.display_name || "Người thương";
  const partnerName =
    members.find((member) => member.user_id !== userId)?.display_name ||
    "người ấy";
  const options = entries.filter(
    (e) =>
      e.kind === "date" &&
      members.length === 2 &&
      members.every((m) => e.liked_by.includes(m.user_id)),
  );
  const wheelColors = ["#f3a6b9", "#f7c98b", "#a9d8c5", "#b9c7ef", "#e7b7d8"];
  const wheelBackground = options.length
    ? `conic-gradient(${options.map((_, index) => `${wheelColors[index % wheelColors.length]} ${(index / options.length) * 100}% ${((index + 1) / options.length) * 100}%`).join(", ")})`
    : "#f8edef";
  const spinWheel = () => {
    if (!options.length || spinning) return;
    const index = Math.floor(Math.random() * options.length);
    setSpinning(true);
    setPick(options[index]);
    setWheelRotation((current) => current + 1440 + (360 - (index + 0.5) * (360 / options.length)));
    window.setTimeout(() => setSpinning(false), 1250);
  };
  const add = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    run(async () => {
      const { error } = await supabase
        .from("couple_entries")
        .insert({
          kind,
          title: values.get("title").trim(),
          note: values.get("note").trim(),
          budget: Number(values.get("budget") || 0),
        });
      if (error) throw error;
      form.reset();
      await notify(
        `${name(userId)} vừa chia sẻ ${kind === "mood" ? "tâm trạng" : kind === "date" ? "một ý tưởng hẹn hò" : "một nhiệm vụ chung"}: ${values.get("title").trim()}`,
      );
    }, "Đã chia sẻ với người thương.");
  };
  const saveMood = (event, mood) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = values.get("title").trim();
    const note = values.get("note").trim();
    run(async () => {
      await rpc("love_entry_edit", {
        p_id: mood.id,
        p_title: title,
        p_note: note,
      });
      setEditingMood(null);
      await notify(`${name(userId)} vừa cập nhật tâm trạng: ${title}`);
    }, "Đã sửa và báo cho người thương.");
  };
  const deleteMood = async (mood) => {
    const result = await Swal.fire({
      title: "Xóa tâm trạng này?",
      text: "Nội dung sẽ biến mất khỏi Góc chung.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Giữ lại",
      confirmButtonColor: "#be4968",
    });
    if (!result.isConfirmed) return;
    run(async () => {
      const { error } = await supabase
        .from("couple_entries")
        .delete()
        .eq("id", mood.id)
        .eq("owner_id", userId);
      if (error) throw error;
      setEditingMood(null);
    }, "Đã xóa tâm trạng.");
  };
  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CÙNG NHAU MỖI NGÀY</p>
          <h2>Góc riêng của hai đứa</h2>
        </div>
        <span>🌷</span>
      </div>
      <form className="card stack" onSubmit={add}>
        <label>
          Mình muốn chia sẻ
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="mood">Tâm trạng hôm nay</option>
            <option value="date">Ý tưởng hẹn hò</option>
            <option value="mission">Nhiệm vụ chung</option>
          </select>
        </label>
        <label>
          {kind === "mood"
            ? "Hôm nay bạn thế nào?"
            : kind === "date"
              ? "Hai đứa đi đâu, làm gì?"
              : "Cùng nhau hoàn thành điều gì?"}
          <input
            name="title"
            key={kind}
            required
            maxLength={180}
            placeholder={
              kind === "mood"
                ? "😊 Vui / 🫂 Cần một cái ôm / Muốn tâm sự…"
                : "Đi bộ 20 phút, nấu một bữa tối…"
            }
          />
        </label>
        <label>
          {kind === "mission"
            ? "Phần thưởng chung khi cả hai hoàn thành"
            : "Lời nhắn"}
          <textarea
            name="note"
            maxLength={1000}
            rows={2}
            placeholder="Một điều nhỏ dành cho tụi mình…"
          />
        </label>
        {kind === "date" && (
          <label>
            Ngân sách dự kiến (đồng)
            <input
              name="budget"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              defaultValue="0"
            />
          </label>
        )}
        <button disabled={busy}>Chia sẻ 💌</button>
      </form>
      <div className="card stack">
        <h3>Hôm nay của hai người</h3>
        {members.map((member) => {
          const mood = entries.find(
            (e) =>
              e.kind === "mood" &&
              e.owner_id === member.user_id &&
              localDate(new Date(e.created_at)) === localDate(),
          );
          return (
            <article key={member.user_id} className="entry">
              <strong>{member.display_name}</strong>
              {mood && editingMood?.id === mood.id ? (
                <form className="stack compact-form" onSubmit={(e) => saveMood(e, mood)}>
                  <label>
                    Tâm trạng
                    <input
                      name="title"
                      required
                      maxLength={180}
                      defaultValue={mood.title}
                    />
                  </label>
                  <label>
                    Lời nhắn
                    <textarea
                      name="note"
                      maxLength={1000}
                      rows={2}
                      defaultValue={mood.note}
                    />
                  </label>
                  <div className="button-row">
                    <button disabled={busy}>Lưu thay đổi</button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => setEditingMood(null)}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p>{mood?.title || "Chưa chia sẻ tâm trạng hôm nay."}</p>
                  {mood?.note && <p className="muted">{mood.note}</p>}
                  {mood?.owner_id === userId && (
                    <div className="button-row">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            async () => {
                              const sent = await notify(
                                `${name(userId)} muốn gửi bạn tâm trạng hôm nay: ${mood.title}${mood.note ? ` — ${mood.note}` : ""}`,
                              );
                              if (!sent)
                                throw new Error(
                                  "Chưa gửi được qua Telegram. Hãy kiểm tra bot và chat ID trong Supabase.",
                                );
                              await Swal.fire({
                                toast: true,
                                position: "top-end",
                                icon: "success",
                                title: `Đã gửi qua Telegram cho ${partnerName} 💌`,
                                showConfirmButton: false,
                                timer: 3200,
                                timerProgressBar: true,
                              });
                            },
                            `Đã gửi qua Telegram cho ${partnerName} 💌`,
                          )
                        }
                      >
                        Gửi cho {partnerName} qua Telegram 💌
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setEditingMood(mood)}
                      >
                        Sửa
                      </button>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => deleteMood(mood)}
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                  {mood?.owner_id === userId && (
                    <small className="muted">
                      Bot Telegram sẽ gửi tâm trạng này đến tài khoản của {partnerName}.
                    </small>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="card stack">
        <div className="section-heading">
          <h3>Danh sách hẹn hò</h3>
          <button
            className="secondary"
            disabled={!options.length}
            onClick={() =>
              setPick(options[Math.floor(Math.random() * options.length)])
            }
          >
            Chọn giúp tụi mình 🎲
          </button>
        </div>
        <p className="muted">
          Chỉ chọn ngẫu nhiên những ý tưởng cả hai đã thả tim.
        </p>
        <div className="date-wheel-card">
          <div className="date-wheel-wrap">
            <span className="date-wheel-pointer" aria-hidden="true">▼</span>
            <div className={`date-wheel ${spinning ? "is-spinning" : ""}`} style={{ background: wheelBackground, transform: `rotate(${wheelRotation}deg)` }} aria-label="Vòng quay hẹn hò">
              <span className="date-wheel-center">♥</span>
            </div>
          </div>
          <div className="date-wheel-controls">
            <button className="primary" disabled={!options.length || spinning} onClick={spinWheel}>
              {spinning ? "Đang quay…" : "Quay ngay 🎡"}
            </button>
            {!options.length && <p className="empty">Cần cả hai cùng thích ít nhất một ý tưởng để bắt đầu quay.</p>}
          </div>
        </div>
        {pick && options.some((e) => e.id === pick.id) && (
          <p role="status" className="notice">
            Hẹn nhau nhé: <strong>{pick.title}</strong> ·{" "}
            {Number(pick.budget).toLocaleString("vi-VN")} đ
          </p>
        )}
        {!entries.some((e) => e.kind === "date") && (
          <p className="empty">Thêm quán ăn hay một nơi hai đứa muốn đi nhé.</p>
        )}
        {entries
          .filter((e) => e.kind === "date")
          .map((e) => (
            <article className="entry" key={e.id}>
              <strong>{e.title}</strong>
              <p>{e.note}</p>
              <p className="muted">
                {name(e.owner_id)} · {Number(e.budget).toLocaleString("vi-VN")}{" "}
                đ
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    rpc("love_entry_toggle", { p_id: e.id, p_action: "like" }),
                  )
                }
              >
                {e.liked_by.includes(userId) ? "♥ Đã thích" : "♡ Mình thích"} (
                {e.liked_by.length}/2)
              </button>
              {e.owner_id === userId && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { error } = await supabase
                        .from("couple_entries")
                        .delete()
                        .eq("id", e.id);
                      if (error) throw error;
                    })
                  }
                >
                  Xóa ý tưởng
                </button>
              )}
            </article>
          ))}
      </div>
      <div className="card stack">
        <h3>Nhiệm vụ chung</h3>
        {!entries.some((e) => e.kind === "mission") && (
          <p className="empty">
            Bắt đầu bằng một việc nhỏ mà hai người đều muốn làm.
          </p>
        )}
        {entries
          .filter((e) => e.kind === "mission")
          .map((e) => (
            <article className="entry" key={e.id}>
              <strong>
                {e.done_by.length === 2 ? "🎉 " : "🌱 "}
                {e.title}
              </strong>
              <p>
                {e.done_by.length === 2
                  ? "Đã mở phần thưởng chung: "
                  : "Cùng hoàn thành để nhận: "}
                {e.note || "Một kỷ niệm đẹp cùng nhau"}
              </p>
              <p className="muted">
                {displayDate(e.created_at)} · {e.done_by.length}/2 người hoàn
                thành
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    rpc("love_entry_toggle", { p_id: e.id, p_action: "done" }),
                  )
                }
              >
                {e.done_by.includes(userId)
                  ? "Bỏ đánh dấu của mình"
                  : "Mình đã hoàn thành ✓"}
              </button>
            </article>
          ))}
      </div>
    </section>
  );
}
