import { supabase } from "./supabaseClient";

export default function WheelSettingsPage({ settings, run, busy }) {
  const save = (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    run(async () => {
      const names = values
        .get("prizes")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const cost = Number(values.get("cost"));
      if (
        !names.length ||
        names.length > 20 ||
        names.some((name) => name.length > 100)
      )
        throw new Error("Điền 1–20 phần quà, mỗi tên tối đa 100 ký tự.");
      if (!Number.isInteger(cost) || cost < 0 || cost > 2147483647)
        throw new Error("Chi phí phải là số nguyên không âm.");
      const colors = [
        "#fda4af",
        "#c4b5fd",
        "#99f6e4",
        "#fde68a",
        "#fdba74",
        "#bae6fd",
      ];
      const { error } = await supabase
        .from("wheel_settings")
        .update({
          spin_cost: cost,
          prizes: names.map((text, i) => ({
            text,
            color: colors[i % colors.length],
          })),
        })
        .eq("id", settings?.id ?? 1)
        .select("id")
        .single();
      if (error) throw error;
    }, "Đã lưu vòng quay.");
  };
  return (
    <form className="card stack" onSubmit={save}>
      <h2>Cài đặt những bất ngờ ⚙️</h2>
      <label>
        Chi phí mỗi lượt (0 = miễn phí)
        <input
          name="cost"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={settings?.spin_cost ?? 2}
        />
      </label>
      <label>
        Phần thưởng (mỗi dòng một quà)
        <textarea
          name="prizes"
          rows={8}
          required
          defaultValue={(settings?.prizes || []).map((p) => p.text).join("\n")}
        />
      </label>
      <p className="muted">
        Mỗi phần quà có cơ hội được chọn như nhau. Người nhận có một lượt miễn
        phí mỗi ngày, không cộng dồn. Cấu hình mới áp dụng từ lượt quay tiếp theo.
      </p>
      <button disabled={busy}>Lưu vòng quay</button>
    </form>
  );
}
