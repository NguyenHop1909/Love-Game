import { useEffect, useRef, useState } from "react";
import { localDate, nextRotation } from "./lib/domain";

export default function LuckyWheel({
  settings,
  totalRewards,
  disabled,
  redeem,
  onSaved,
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const lock = useRef(false);
  const timer = useRef(null);
  const audio = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      audio.current?.pause();
    };
  }, []);
  const prizes = snapshot || settings?.prizes || [];
  const spin = async (free) => {
    if (lock.current || disabled) return;
    lock.current = true;
    setSpinning(true);
    setError("");
    setResult(null);
    try {
      const saved = await redeem(free ? "FREE_SPIN" : "SPIN");
      if (!mounted.current) return;
      setSnapshot(saved.prizes);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (sound && !reduce) {
        audio.current = new Audio("/xosoMB.wav");
        audio.current.play().catch(() => {});
      }
      setRotation((previous) =>
        nextRotation(previous, saved.index, saved.prizes.length),
      );
      timer.current = setTimeout(
        () => {
          audio.current?.pause();
          if (mounted.current) {
            setResult(saved.prize);
            setSpinning(false);
            lock.current = false;
          }
        },
        reduce ? 30 : 4200,
      );
      // The result is already committed on the server, even if the page closes mid-animation.
      await onSaved(saved);
    } catch (err) {
      if (mounted.current) {
        setError(
          err.message || "Chưa quay được. Thử lại để kiểm tra giao dịch.",
        );
        setSpinning(false);
      }
      lock.current = false;
    }
  };
  const cost = settings?.spin_cost ?? 2;
  const freeSpinAvailable = settings?.last_free_spin_date !== localDate();
  return (
    <section className="card wheel-card stack">
      <div className="section-heading">
        <h3>Vòng quay bất ngờ 🎡</h3>
        <label className="sound-toggle">
          <input
            type="checkbox"
            checked={sound}
            onChange={(event) => setSound(event.target.checked)}
          />{" "}
          Bật nhạc
        </label>
      </div>
      <p className="muted">
        Quà được lưu ngay khi quay. Đóng trang giữa chừng vẫn tìm được trong
        túi.
      </p>
      <div className="wheel-frame">
        <span className="wheel-pointer" aria-hidden="true">
          ▼
        </span>
        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: prizes.length
              ? `conic-gradient(${prizes.map((p, i) => `${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#fecdd3"} ${(i * 360) / prizes.length}deg ${((i + 1) * 360) / prizes.length}deg`).join(",")})`
              : "#fecdd3",
          }}
        >
          {prizes.map((prize, i) => (
            <div
              className="wheel-segment"
              key={i}
              style={{
                transform: `rotate(${((i + 0.5) * 360) / prizes.length}deg)`,
              }}
            >
              <span>{prize.text}</span>
            </div>
          ))}
        </div>
        <span className="wheel-heart" aria-hidden="true">
          ♡
        </span>
      </div>
      <div className="actions centered">
        <button
          disabled={
            disabled ||
            spinning ||
            !prizes.length ||
            (cost > 0 && totalRewards < cost)
          }
          onClick={() => spin(false)}
        >
          {spinning ? "Đang quay…" : `Quay · ${cost} phiếu`}
        </button>
        {freeSpinAvailable && (
          <button
            className="secondary"
            disabled={disabled || spinning || !prizes.length}
            onClick={() => spin(true)}
          >
            Lượt miễn phí hôm nay
          </button>
        )}
        {!freeSpinAvailable && (
          <span className="muted">Đã dùng lượt miễn phí hôm nay</span>
        )}
      </div>
      {result && (
        <p role="status" className="notice">
          🎉 Bạn nhận được: <strong>{result}</strong>. Quà đã vào túi!
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
