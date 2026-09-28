import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Swal from "sweetalert2";
import { isConfigured, supabase, rpc, notifyPartner } from "./supabaseClient";
import {
  balanceOf,
  displayDate,
  localDate,
  memberRole,
  validQuizLink,
} from "./lib/domain";
import { useLoveData } from "./lib/useLoveData";
import LuckyWheel from "./LuckyWheel";
import GiftInventory from "./GiftInventory";
import SharedSpace from "./SharedSpace";
import WheelSettingsPage from "./WheelSettingsPage";
const ChartSummary = lazy(() => import("./ChartSummary"));

async function confirmAction(text) {
  const result = await Swal.fire({
    title: "Xác nhận nhé?",
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Đồng ý",
    cancelButtonText: "Để sau",
    confirmButtonColor: "#be4968",
  });
  return result.isConfirmed;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(isConfigured);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    // Discard the legacy browser-only login; it never grants access anymore.
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("user_role");
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecking(false);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) setAuthError(error.message);
        setSession(data.session);
        setChecking(false);
      })
      .catch((error) => {
        setAuthError(error.message);
        setChecking(false);
      });
    return () => subscription.unsubscribe();
  }, []);
  if (!isConfigured)
    return (
      <main className="login-wrap">
        <section className="card login-card">
          <span className="hero-icon">💌</span>
          <h1>Góc nhỏ của tụi mình</h1>
          <p>
            Web chưa được kết nối. Điền VITE_SUPABASE_URL và
            VITE_SUPABASE_ANON_KEY vào .env.local rồi khởi động lại.
          </p>
          <p className="muted">
            Xem README để hoàn tất thiết lập hai tài khoản riêng.
          </p>
        </section>
      </main>
    );
  if (checking)
    return (
      <main className="login-wrap" role="status">
        Đang mở góc nhỏ của tụi mình…
      </main>
    );
  return session ? (
    <LoveSpace key={session.user.id} user={session.user} />
  ) : (
    <Login initialError={authError} />
  );
}

function Login({ initialError }) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.get("email").trim(),
        password: form.get("password"),
      });
      if (error) throw error;
    } catch {
      setError("Chưa đăng nhập được. Kiểm tra email, mật khẩu và kết nối nhé.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-wrap">
      <section className="card login-card">
        <span className="hero-icon">💌</span>
        <p className="eyebrow">CHỈ DÀNH CHO HAI ĐỨA</p>
        <h1>Góc nhỏ của tụi mình</h1>
        <p className="muted">Một chút quan tâm, một chút bất ngờ, mỗi ngày.</p>
        <form onSubmit={login} className="stack">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="Email của bạn"
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Mật khẩu riêng của bạn"
            />
          </label>
          <button disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Vào nhà thôi ♡"}
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function LoveSpace({ user }) {
  const { data, error, connected, refresh } = useLoveData(user.id);
  const [tab, setTab] = useState("today");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const lock = useRef(false);
  const pendingRequests = useRef(new Map());
  const run = useCallback(
    async (action, success = "") => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setMessage("");
      setActionError("");
      try {
        await action();
        if (success) setMessage(success);
        await refresh();
      } catch (err) {
        setActionError(err.message || "Chưa lưu được. Thử lại nhé.");
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const notify = async (text) => {
    try {
      if (!(await notifyPartner(text)))
        setMessage(
          "Dữ liệu đã lưu. Telegram chưa gửi được; người kia vẫn xem được trong web.",
        );
    } catch {
      setMessage("Dữ liệu đã lưu. Telegram tạm thời chưa kết nối.");
    }
  };
  const redeem = async (kind) => {
    // Persist the request ID before sending: retry after an interrupted response cannot double-charge.
    const key = `love-pending:${user.id}:${kind}`;
    let id = pendingRequests.current.get(kind) || localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    pendingRequests.current.set(kind, id);
    try {
      const result = await rpc("love_redeem", {
        p_request_id: id,
        p_kind: kind,
      });
      pendingRequests.current.delete(kind);
      localStorage.removeItem(key);
      return result;
    } catch (err) {
      // A server rejection is definitive; transport failures keep the idempotency key for retry.
      if (err.code === "P0001" || err.code === "42501") {
        pendingRequests.current.delete(kind);
        localStorage.removeItem(key);
      }
      throw err;
    }
  };
  const signOut = () =>
    run(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    });
  if (!data)
    return (
      <main className="login-wrap">
        <section className="card">
          <p role="status">{error || "Đang tải những điều nhỏ xinh…"}</p>
          <button onClick={refresh}>Tải lại</button>
          <button className="text-button" onClick={signOut}>
            Đăng xuất
          </button>
        </section>
      </main>
    );
  const me = data.love_members.find((member) => member.user_id === user.id);
  const role = memberRole(me);
  if (!role)
    return (
      <main className="login-wrap">
        <section className="card">
          <h1>Tài khoản chưa được mời</h1>
          <p>Chủ web cần thêm tài khoản này vào danh sách hai thành viên.</p>
          <button onClick={signOut}>Đăng xuất</button>
        </section>
      </main>
    );
  const admin = role === "admin";
  const total = balanceOf(data.rewards_penalties);
  const settings = data.wheel_settings.find((s) => s.id === 1);
  const pending = data.quizzes.filter((q) => q.status !== "COMPLETED");
  const waiting = data.user_inventory.filter((g) =>
    ["Chờ hẹn", "Đã hẹn"].includes(g.status),
  );
  const tabs = [
    ["today", "☀️", "Hôm nay"],
    ["tasks", "🌱", "Nhiệm vụ"],
    ["gifts", "🎁", "Quà"],
    ["together", "💌", "Góc chung"],
    ["history", "📖", "Nhật ký"],
  ];
  if (admin) tabs.push(["settings", "⚙️", "Cài đặt"]);
  const chart = [...data.rewards_penalties]
    .reverse()
    .slice(-30)
    .map((row) => ({
      date: displayDate(row.date),
      reward: Number(row.reward_amount),
      penalty: Number(row.penalty_amount),
    }));
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("today");
          }}
        >
          ♡ <span>Góc nhỏ của tụi mình</span>
        </a>
        <button className="text-button" disabled={busy} onClick={signOut}>
          Đăng xuất
        </button>
      </header>
      <main className="page-content">
        <div className="welcome">
          <div>
            <p className="eyebrow">MỘT NGÀY NỮA, CÓ NHAU</p>
            <h1>
              Chào {me.display_name} <span>🌷</span>
            </h1>
            <p className="muted">
              {displayDate(localDate())} · Những điều nhỏ làm nên ngày đáng nhớ.
            </p>
          </div>
          <span className={`connection ${connected ? "live" : ""}`}>
            {connected ? "● Đang đồng bộ" : "○ Đang kết nối lại"}
          </span>
        </div>
        <nav className="tabs" aria-label="Điều hướng chính">
          {tabs.map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        {(error || actionError) && (
          <div className="error" role="alert">
            {actionError || error}
            <button className="text-button" onClick={refresh}>
              Tải lại dữ liệu
            </button>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {tab === "today" && (
          <section className="stack">
            <div className="hero-card">
              <div>
                <p className="eyebrow">HÔM NAY CỦA TỤI MÌNH</p>
                <h2>
                  Để dành một chút
                  <br />
                  ngọt ngào cho nhau.
                </h2>
                <p>Một lời nhắn, một nhiệm vụ nhỏ, hay một buổi hẹn?</p>
                <button onClick={() => setTab("together")}>
                  Gửi một lời quan tâm 💌
                </button>
              </div>
              <span className="hero-art" aria-hidden="true">
                💑
              </span>
            </div>
            <div className="stats">
              <button className="stat" onClick={() => setTab("gifts")}>
                <span>🎟️ Phiếu hiện có</span>
                <strong>{total}</strong>
                <small>Số dư từ lịch sử thực tế</small>
              </button>
              <button className="stat" onClick={() => setTab("tasks")}>
                <span>🌱 Nhiệm vụ còn lại</span>
                <strong>{pending.length}</strong>
                <small>Cùng hoàn thành từng chút</small>
              </button>
              <button className="stat" onClick={() => setTab("gifts")}>
                <span>🎁 Quà đang chờ hẹn</span>
                <strong>{waiting.length}</strong>
                <small>Chọn một ngày dành cho nhau</small>
              </button>
            </div>
            <div className="two-columns">
              <section className="card stack">
                <h3>Điều cần làm tiếp theo</h3>
                {waiting.length ? (
                  waiting.slice(0, 3).map((g) => (
                    <div className="entry" key={g.id}>
                      <strong>{g.prize_text}</strong>
                      <p>
                        {g.status} · {displayDate(g.scheduled_for)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="empty">
                    Chưa có quà đang chờ. Tích phiếu rồi hẹn nhau nhé!
                  </p>
                )}
                <button className="secondary" onClick={() => setTab("gifts")}>
                  Xem quà của tụi mình
                </button>
              </section>
              <section className="card stack">
                <h3>Một lời nhắn gần đây</h3>
                {data.couple_entries.find((e) => e.kind === "mood") ? (
                  (() => {
                    const entry = data.couple_entries.find(
                      (e) => e.kind === "mood",
                    );
                    return (
                      <>
                        <p className="quote">“{entry.title}”</p>
                        <p>{entry.note}</p>
                        <small className="muted">
                          {
                            data.love_members.find(
                              (m) => m.user_id === entry.owner_id,
                            )?.display_name
                          }{" "}
                          · {displayDate(entry.created_at)}
                        </small>
                      </>
                    );
                  })()
                ) : (
                  <p className="empty">
                    Hôm nay bạn thấy thế nào? Kể người thương nghe nhé.
                  </p>
                )}
                <button
                  className="secondary"
                  onClick={() => setTab("together")}
                >
                  Ghé góc chung
                </button>
              </section>
            </div>
          </section>
        )}
        {tab === "tasks" && (
          <QuizList
            quizzes={data.quizzes}
            admin={admin}
            userId={user.id}
            run={run}
            busy={busy}
            notify={notify}
          />
        )}
        {tab === "gifts" && (
          <section className="stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NHỮNG BẤT NGỜ NHỎ</p>
                <h2>Quà & những cuộc hẹn</h2>
              </div>
              <span className="pill">{total} phiếu</span>
            </div>
            {!admin && (
              <>
                <div className="card">
                  <h3>Đổi một chút ngọt ngào</h3>
                  <p className="muted">
                    Quà vào túi trước. Hai người sẽ hẹn thời gian phù hợp cùng
                    nhau.
                  </p>
                  <div className="actions">
                    {[
                      ["HUN_MOI", 10, "Hun môi 💋"],
                      ["HUN_SAU", 50, "Hun sâu 💕"],
                    ].map(([kind, cost, label]) => (
                      <button
                        key={kind}
                        disabled={busy || total < cost}
                        onClick={async () => {
                          if (
                            !(await confirmAction(
                              `Dùng ${cost} phiếu để đổi ${label}?`,
                            ))
                          )
                            return;
                          run(async () => {
                            const gift = await redeem(kind);
                            setMessage(`Đã đổi ${gift.prize}. Quà đã vào túi!`);
                            await notify(
                              `Có quà mới: ${gift.prize}. Mở Love Game để hẹn nhau nhé!`,
                            );
                          });
                        }}
                      >
                        {label} · {cost} phiếu
                      </button>
                    ))}
                  </div>
                </div>
                <LuckyWheel
                  settings={settings}
                  totalRewards={total}
                  disabled={busy}
                  redeem={redeem}
                  onSaved={async (result) => {
                    await refresh();
                    await notify(
                      `Vừa quay được: ${result.prize}. Quà đã vào túi rồi!`,
                    );
                  }}
                />
              </>
            )}
            <GiftInventory
              items={data.user_inventory}
              admin={admin}
              busy={busy}
              run={run}
              notify={notify}
            />
          </section>
        )}
        {tab === "together" && (
          <SharedSpace
            entries={data.couple_entries}
            members={data.love_members}
            userId={user.id}
            busy={busy}
            run={run}
          />
        )}
        {tab === "history" && (
          <section className="stack">
            <h2>Nhật ký phiếu của tụi mình</h2>
            {admin && <TicketForm run={run} busy={busy} />}
            <Suspense fallback={<p role="status">Đang mở biểu đồ…</p>}>
              <ChartSummary data={chart} />
            </Suspense>
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Thưởng / Đổi</th>
                    <th>Phạt</th>
                    <th>Lý do</th>
                    {admin && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.rewards_penalties.map((row) => (
                    <tr key={row.id}>
                      <td>{displayDate(row.date)}</td>
                      <td>
                        {Number(row.reward_amount) > 0 ? "+" : ""}
                        {row.reward_amount}
                      </td>
                      <td>
                        {Number(row.penalty_amount)
                          ? `−${row.penalty_amount}`
                          : "0"}
                      </td>
                      <td>
                        {row.reward_reason ||
                          row.penalty_reason ||
                          "Không có ghi chú"}
                      </td>
                      {admin && (
                        <td>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                !(await confirmAction(
                                  "Xóa dòng này sẽ thay đổi số dư phiếu. Tiếp tục?",
                                ))
                              )
                                return;
                              run(async () => {
                                const { error } = await supabase
                                  .from("rewards_penalties")
                                  .delete()
                                  .eq("id", row.id);
                                if (error) throw error;
                              }, "Đã xóa dòng phiếu.");
                            }}
                          >
                            Xóa
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => editTicket(row, run)}
                          >
                            Sửa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rewards_penalties.length && (
                <p className="empty">Chưa có giao dịch nào.</p>
              )}
            </div>
            {admin && (
              <>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const ok = await notifyPartner(
                        `Tổng kết ngày ${displayDate(localDate())}: số dư hiện tại ${total} phiếu.`,
                        "both",
                      );
                      if (!ok)
                        throw new Error(
                          "Telegram chưa gửi được. Dữ liệu vẫn được lưu.",
                        );
                    }, "Đã gửi tổng kết cho cả hai.")
                  }
                >
                  Gửi tổng kết Telegram
                </button>
                <details className="card">
                  <summary>Lịch sử thay đổi (50 mục gần nhất)</summary>
                  {data.audit_logs.map((log) => (
                    <p className="audit-entry" key={log.id}>
                      {displayDate(log.created_at)} · {log.admin_name} ·{" "}
                      {log.action_type}
                      <br />
                      <small>{log.action_details}</small>
                    </p>
                  ))}
                </details>
              </>
            )}
          </section>
        )}
        {tab === "settings" && admin && (
          <WheelSettingsPage
            key={JSON.stringify(settings)}
            settings={settings}
            run={run}
            busy={busy}
          />
        )}
        <footer>Được tạo để hai đứa có thêm những ngày vui ♡</footer>
      </main>
    </div>
  );
}

function QuizList({ quizzes, admin, userId, run, busy, notify }) {
  const addQuiz = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const link = new FormData(form).get("link").trim();
    run(async () => {
      if (!validQuizLink(link))
        throw new Error(
          "Dùng đường dẫn HTTPS từ kahoot.it hoặc kahoot.com nhé.",
        );
      const { error } = await supabase
        .from("quizzes")
        .insert({ link_kahoot: link, status: "PENDING" });
      if (error) throw error;
      form.reset();
      await notify(`Có nhiệm vụ Kahoot mới: ${link}`);
    });
  };
  const submit = (event, quiz) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    run(async () => {
      const score = Number(values.get("score"));
      const file = values.get("proof");
      if (!Number.isInteger(score) || score < 0 || score > 2147483647)
        throw new Error("Điểm phải là số nguyên không âm.");
      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      if (!extensions[file.type] || !file.size || file.size > 5 * 1024 * 1024)
        throw new Error("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.");
      const path = `${userId}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from("quiz-images")
        .upload(path, file);
      if (uploadError) throw uploadError;
      try {
        await rpc("love_submit_quiz", {
          p_id: String(quiz.id),
          p_score: score,
          p_proof_path: path,
        });
      } catch (err) {
        // Do not remove a potentially referenced proof after an ambiguous network response.
        if (err.code === "P0001")
          await supabase.storage.from("quiz-images").remove([path]);
        throw err;
      }
      await notify(
        `Đã hoàn thành Kahoot với ${score} điểm! Xem ảnh minh chứng trong web nhé.`,
      );
    });
  };
  return (
    <section className="stack">
      <h2>Nhiệm vụ nhỏ mỗi ngày 🌱</h2>
      {admin && (
        <form className="card actions" onSubmit={addQuiz}>
          <label className="grow">
            Link Kahoot
            <input
              name="link"
              type="url"
              required
              placeholder="https://kahoot.it/…"
            />
          </label>
          <button disabled={busy}>Giao nhiệm vụ</button>
        </form>
      )}
      {!quizzes.length && (
        <div className="card empty">
          Chưa có nhiệm vụ. Hôm nay dành chút thời gian cho nhau nhé!
        </div>
      )}
      {quizzes.map((quiz) => (
        <article className="card stack" key={quiz.id}>
          <div className="section-heading">
            <h3>
              {quiz.status === "COMPLETED"
                ? "✅ Đã hoàn thành"
                : "🎯 Thử thách Kahoot"}
            </h3>
            <small>{displayDate(quiz.created_at)}</small>
          </div>
          {validQuizLink(quiz.link_kahoot) ? (
            <a href={quiz.link_kahoot} target="_blank" rel="noreferrer">
              Mở bài Kahoot ↗
            </a>
          ) : (
            <p className="error">
              Link chưa hợp lệ. Người giao bài cần sửa lại.
            </p>
          )}
          {quiz.status === "COMPLETED" ? (
            <p>
              Điểm đạt được: <strong>{quiz.score}</strong>
            </p>
          ) : (
            !admin && (
              <form className="stack" onSubmit={(event) => submit(event, quiz)}>
                <label>
                  Điểm của bạn
                  <input
                    name="score"
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    required
                  />
                </label>
                <label>
                  Ảnh minh chứng (tối đa 5 MB)
                  <input
                    name="proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <button disabled={busy}>Nộp kết quả</button>
              </form>
            )
          )}
          {quiz.proof_path && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { data, error } = await supabase.storage
                    .from("quiz-images")
                    .createSignedUrl(quiz.proof_path, 60);
                  if (error) throw error;
                  await Swal.fire({
                    title: "Ảnh minh chứng",
                    imageUrl: data.signedUrl,
                    imageAlt: "Kết quả Kahoot",
                    confirmButtonText: "Đóng",
                  });
                })
              }
            >
              Xem ảnh minh chứng
            </button>
          )}
          {admin && (
            <div className="actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  const result = await Swal.fire({
                    title: "Sửa link Kahoot",
                    input: "url",
                    inputValue: quiz.link_kahoot,
                    showCancelButton: true,
                    inputValidator: (value) =>
                      validQuizLink(value)
                        ? undefined
                        : "Nhập link HTTPS của Kahoot.",
                  });
                  if (result.isConfirmed)
                    run(async () => {
                      const { error } = await supabase
                        .from("quizzes")
                        .update({ link_kahoot: result.value })
                        .eq("id", quiz.id);
                      if (error) throw error;
                    });
                }}
              >
                Sửa link
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (await confirmAction("Xóa nhiệm vụ này?"))
                    run(async () => {
                      const { error } = await supabase
                        .from("quizzes")
                        .delete()
                        .eq("id", quiz.id);
                      if (error) throw error;
                    });
                }}
              >
                Xóa nhiệm vụ
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function TicketForm({ run, busy }) {
  return (
    <form
      className="card stack"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        run(async () => {
          const reward = Number(values.get("reward"));
          const penalty = Number(values.get("penalty"));
          if (
            ![reward, penalty].every(
              (n) => Number.isInteger(n) && n >= 0 && n <= 2147483647,
            ) ||
            !(reward || penalty)
          )
            throw new Error(
              "Nhập số phiếu nguyên không âm, có ít nhất một phiếu.",
            );
          const reason = values.get("reason").trim();
          const { error } = await supabase
            .from("rewards_penalties")
            .insert({
              date: values.get("date"),
              reward_amount: reward,
              penalty_amount: penalty,
              reward_reason: reward ? reason : null,
              penalty_reason: penalty ? reason : null,
            });
          if (error) throw error;
          form.reset();
        }, "Đã ghi phiếu vào nhật ký.");
      }}
    >
      <h3>Ghi nhận phiếu</h3>
      <div className="form-grid">
        <label>
          Ngày
          <input type="date" name="date" defaultValue={localDate()} required />
        </label>
        <label>
          Phiếu thưởng
          <input
            type="number"
            name="reward"
            defaultValue="0"
            min="0"
            step="1"
            required
          />
        </label>
        <label>
          Phiếu phạt
          <input
            type="number"
            name="penalty"
            defaultValue="0"
            min="0"
            step="1"
            required
          />
        </label>
      </div>
      <label>
        Lý do
        <input name="reason" maxLength={500} required />
      </label>
      <button disabled={busy}>Lưu phiếu</button>
    </form>
  );
}

async function editTicket(row, run) {
  // DOM assignment avoids interpolating user-supplied reasons into HTML.
  const result = await Swal.fire({
    title: "Sửa dòng phiếu",
    html: '<label>Phiếu thưởng / đổi<input id="edit-reward" type="number" class="swal2-input"></label><label>Phiếu phạt<input id="edit-penalty" type="number" min="0" class="swal2-input"></label><label>Lý do<input id="edit-reason" maxlength="500" class="swal2-input"></label>',
    showCancelButton: true,
    didOpen: () => {
      document.getElementById("edit-reward").value = row.reward_amount;
      document.getElementById("edit-penalty").value = row.penalty_amount;
      document.getElementById("edit-reason").value =
        row.reward_reason || row.penalty_reason || "";
    },
    preConfirm: () => {
      const reward = Number(document.getElementById("edit-reward").value);
      const penalty = Number(document.getElementById("edit-penalty").value);
      const reason = document.getElementById("edit-reason").value.trim();
      if (
        ![reward, penalty].every(
          (n) => Number.isInteger(n) && Math.abs(n) <= 2147483647,
        ) ||
        penalty < 0 ||
        !reason
      ) {
        Swal.showValidationMessage("Điền số phiếu nguyên hợp lệ và lý do.");
        return false;
      }
      return {
        reward_amount: reward,
        penalty_amount: penalty,
        reward_reason: reward ? reason : null,
        penalty_reason: penalty ? reason : null,
      };
    },
  });
  if (result.isConfirmed)
    run(async () => {
      const { error } = await supabase
        .from("rewards_penalties")
        .update(result.value)
        .eq("id", row.id);
      if (error) throw error;
    }, "Đã cập nhật dòng phiếu.");
}
