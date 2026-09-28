import { useState } from "react";
import { supabase, rpc } from "./supabaseClient";
import { displayDate, localDate } from "./lib/domain";

export default function SharedSpace({ entries, members, userId, run, busy }) {
  const [kind, setKind] = useState("mood");
  const [pick, setPick] = useState(null);
  const name = (id) =>
    members.find((m) => m.user_id === id)?.display_name || "Người thương";
  const options = entries.filter(
    (e) =>
      e.kind === "date" &&
      members.length === 2 &&
      members.every((m) => e.liked_by.includes(m.user_id)),
  );
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
    }, "Đã chia sẻ với người thương.");
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
              <p>{mood?.title || "Chưa chia sẻ tâm trạng hôm nay."}</p>
              {mood?.note && <p className="muted">{mood.note}</p>}
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
