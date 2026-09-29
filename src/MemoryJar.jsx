import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { displayDate, localDate } from "./lib/domain";
import { supabase } from "./supabaseClient";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    members.find((member) => member.user_id === id)?.display_name || "NgÆ°á»i thÆ°Æ¡ng";

  const addMemory = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    run(async () => {
      const file = values.get("image");
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      if (!extensions[file.type] || !file.size || file.size > MAX_IMAGE_SIZE)
        throw new Error("Chá»n áº£nh JPG, PNG hoáº·c WebP, tá»‘i Ä‘a 20 MB.");
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
    }, "ÄÃ£ cáº¥t ká»· niá»‡m vÃ o hÅ© ðŸ“¸");
  };

  const removeMemory = async (memory) => {
    const result = await Swal.fire({
      title: "XÃ³a ká»· niá»‡m nÃ y?",
      text: "áº¢nh vÃ  lá»i nháº¯n sáº½ Ä‘Æ°á»£c xÃ³a khá»i hÅ© ká»· niá»‡m.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "XÃ³a",
      cancelButtonText: "Giá»¯ láº¡i",
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
    }, "ÄÃ£ xÃ³a ká»· niá»‡m.");
  };

  const monthLabel = new Date(`${month}-15T12:00:00+07:00`).toLocaleDateString(
    "vi-VN",
    { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" },
  );

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cáº¤T GIá»® NHá»®NG NGÃ€Y THÆ¯Æ NG</p>
          <h2>HÅ© ká»· niá»‡m ðŸ“¸</h2>
        </div>
        <label className="month-picker">
          Xem thÃ¡ng
          <input
            type="month"
            value={month}
            max={localDate().slice(0, 7)}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>

      <form className="card stack" onSubmit={addMemory}>
        <h3>ThÃªm má»™t ká»· niá»‡m</h3>
        <div className="form-grid memory-form-grid">
          <label>
            NgÃ y Ä‘áº·c biá»‡t
            <input name="memory_date" type="date" defaultValue={localDate()} required />
          </label>
          <label>
            TÃªn ká»· niá»‡m
            <input name="title" maxLength={120} required placeholder="Buá»•i háº¹n tháº­t vuiâ€¦" />
          </label>
          <label>
            áº¢nh ká»· niá»‡m
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
        </div>
        <label>
          Lá»i nháº¯n
          <textarea name="note" maxLength={1000} rows={3} placeholder="Äiá»u mÃ¬nh muá»‘n nhá»› vá» ngÃ y nÃ yâ€¦" />
        </label>
        <button disabled={busy}>Cáº¥t vÃ o hÅ© ðŸ’—</button>
      </form>

      <div className="memory-recap card">
        <p className="eyebrow">THÃNG NÃ€Y Cá»¦A Tá»¤I MÃŒNH</p>
        <h3>{monthLabel}</h3>
        <p>
          Hai Ä‘á»©a Ä‘Ã£ cáº¥t giá»¯ <strong>{monthly.length}</strong> ká»· niá»‡m
          {monthly.length ? " trong thÃ¡ng nÃ y." : ". HÃ£y thÃªm khoáº£nh kháº¯c Ä‘áº§u tiÃªn nhÃ©!"}
        </p>
      </div>

      {monthly.length ? (
        <div className="memory-grid">
          {monthly.map((memory) => (
            <article className="memory-card" key={memory.id}>
              {imageUrls[memory.image_path] ? (
                <img src={imageUrls[memory.image_path]} alt={memory.title} loading="lazy" />
              ) : (
                <div className="memory-placeholder">Äang má»Ÿ áº£nhâ€¦</div>
              )}
              <div className="memory-copy">
                <small>{displayDate(memory.memory_date)} Â· {ownerName(memory.owner_id)}</small>
                <h3>{memory.title}</h3>
                {memory.note && <p>{memory.note}</p>}
                {memory.owner_id === userId && (
                  <button className="text-button danger" disabled={busy} onClick={() => removeMemory(memory)}>
                    XÃ³a ká»· niá»‡m
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">ThÃ¡ng nÃ y chÆ°a cÃ³ áº£nh nÃ o trong hÅ©.</div>
      )}
    </section>
  );
}

