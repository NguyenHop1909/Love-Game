import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { displayDate, localDate } from "./lib/domain";
import { supabase } from "./supabaseClient";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function MemoryJar({ memories, members, userId, busy, run }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [imageUrls, setImageUrls] = useState({});
  const monthly = useMemo(
    () =>
      memories
        .filter((memory) => memory.memory_date?.startsWith(month))
        .sort((a, b) => a.memory_date.localeCompare(b.memory_date)),
    [memories, month],
  );

  useEffect(() => {
    let active = true;
    const paths = [...new Set(monthly.map((memory) => memory.image_path).filter(Boolean))];
    if (!paths.length) {
      setImageUrls({});
      return () => {
        active = false;
      };
    }
    supabase.storage
      .from("couple-memories")
      .createSignedUrls(paths, 60 * 60)
      .then(({ data }) => {
        if (!active) return;
        setImageUrls(
          Object.fromEntries((data || []).map((item) => [item.path, item.signedUrl])),
        );
      });
    return () => {
      active = false;
    };
  }, [monthly]);

  const ownerName = (id) =>
    members.find((member) => member.user_id === id)?.display_name || "Người thương";

  const addMemory = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    run(async () => {
      const file = values.get("image");
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      if (!extensions[file.type] || !file.size || file.size > MAX_IMAGE_SIZE)
        throw new Error("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.");
      const imagePath = `${userId}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from("couple-memories")
        .upload(imagePath, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("couple_memories").insert({
        owner_id: userId,
        memory_date: values.get("memory_date"),
        title: values.get("title").trim(),
        note: values.get("note").trim(),
        image_path: imagePath,
      });
      if (error) {
        await supabase.storage.from("couple-memories").remove([imagePath]);
        throw error;
      }
      form.reset();
    }, "Đã cất kỷ niệm vào hũ 📸");
  };

  const removeMemory = async (memory) => {
    const result = await Swal.fire({
      title: "Xóa kỷ niệm này?",
      text: "Ảnh và lời nhắn sẽ được xóa khỏi hũ kỷ niệm.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Giữ lại",
      confirmButtonColor: "#be4968",
    });
    if (!result.isConfirmed) return;
    run(async () => {
      const { error } = await supabase
        .from("couple_memories")
        .delete()
        .eq("id", memory.id)
        .eq("owner_id", userId);
      if (error) throw error;
      const { error: storageError } = await supabase.storage
        .from("couple-memories")
        .remove([memory.image_path]);
      if (storageError) throw storageError;
    }, "Đã xóa kỷ niệm.");
  };

  const monthLabel = new Date(`${month}-15T12:00:00+07:00`).toLocaleDateString(
    "vi-VN",
    { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" },
  );

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CẤT GIỮ NHỮNG NGÀY THƯƠNG</p>
          <h2>Hũ kỷ niệm 📸</h2>
        </div>
        <label className="month-picker">
          Xem tháng
          <input
            type="month"
            value={month}
            max={localDate().slice(0, 7)}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>

      <form className="card stack" onSubmit={addMemory}>
        <h3>Thêm một kỷ niệm</h3>
        <div className="form-grid memory-form-grid">
          <label>
            Ngày đặc biệt
            <input name="memory_date" type="date" defaultValue={localDate()} required />
          </label>
          <label>
            Tên kỷ niệm
            <input name="title" maxLength={120} required placeholder="Buổi hẹn thật vui…" />
          </label>
          <label>
            Ảnh kỷ niệm
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
        </div>
        <label>
          Lời nhắn
          <textarea name="note" maxLength={1000} rows={3} placeholder="Điều mình muốn nhớ về ngày này…" />
        </label>
        <button disabled={busy}>Cất vào hũ 💗</button>
      </form>

      <div className="memory-recap card">
        <p className="eyebrow">THÁNG NÀY CỦA TỤI MÌNH</p>
        <h3>{monthLabel}</h3>
        <p>
          Hai đứa đã cất giữ <strong>{monthly.length}</strong> kỷ niệm
          {monthly.length ? " trong tháng này." : ". Hãy thêm khoảnh khắc đầu tiên nhé!"}
        </p>
      </div>

      {monthly.length ? (
        <div className="memory-grid">
          {monthly.map((memory) => (
            <article className="memory-card" key={memory.id}>
              {imageUrls[memory.image_path] ? (
                <img src={imageUrls[memory.image_path]} alt={memory.title} loading="lazy" />
              ) : (
                <div className="memory-placeholder">Đang mở ảnh…</div>
              )}
              <div className="memory-copy">
                <small>{displayDate(memory.memory_date)} · {ownerName(memory.owner_id)}</small>
                <h3>{memory.title}</h3>
                {memory.note && <p>{memory.note}</p>}
                {memory.owner_id === userId && (
                  <button className="text-button danger" disabled={busy} onClick={() => removeMemory(memory)}>
                    Xóa kỷ niệm
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">Tháng này chưa có ảnh nào trong hũ.</div>
      )}
    </section>
  );
}
