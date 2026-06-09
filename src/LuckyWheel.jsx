import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { supabase } from "./supabaseClient";

// Khởi tạo đối tượng Audio từ thư mục public
const audioQuay = new Audio("/xosoMB.wav");

export default function LuckyWheel({ totalRewards, onWin, loading }) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [prizes, setPrizes] = useState([]);
  const [spinCost, setSpinCost] = useState(2);

  // Dùng ref để lưu chỉ số trúng thưởng, tránh lỗi closure trong setTimeout
  const currentPrizeIndexRef = useRef(0);

  // 1. Tải cấu hình vòng quay và lắng nghe Realtime thay đổi từ Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("wheel_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (data) {
        setPrizes(data.prizes || []);
        setSpinCost(data.spin_cost || 0);
      }
    };
    fetchSettings();

    const channel = supabase
      .channel("wheel_settings_channel")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wheel_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          const newPrizes =
            typeof payload.new.prizes === "string"
              ? JSON.parse(payload.new.prizes)
              : payload.new.prizes;
          setPrizes(newPrizes || []);
          setSpinCost(payload.new.spin_cost || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Dọn dẹp tắt nhạc hoàn toàn nếu component bị unmount đột ngột
      audioQuay.pause();
      audioQuay.currentTime = 0;
    };
  }, []);

  // 2. Hàm xử lý logic quay bánh xe
  const handleSpin = () => {
    if (isSpinning || loading || prizes.length === 0) return;

    // Kiểm tra số dư phiếu thưởng thực tế
    if (totalRewards < spinCost) {
      Swal.fire({
        title: "Nghèo quá ní ơi! 💀",
        text: `Vòng quay nhân phẩm tốn ${spinCost} phiếu/lượt. Ní hiện tại mới có ${totalRewards} phiếu hà!`,
        icon: "error",
        confirmButtonColor: "#ff85c0",
        background: "#fff0f6"
      });
      return;
    }

    setIsSpinning(true);

    // Kích hoạt nhạc nền vòng quay (Reset và bật lặp lại liên tục)
    audioQuay.currentTime = 0;
    audioQuay.loop = true;
    audioQuay.play().catch((err) => console.log("Trình duyệt chặn phát nhạc tự động:", err));

    const prizeCount = prizes.length;
    const randomPrizeIndex = Math.floor(Math.random() * prizeCount);
    currentPrizeIndexRef.current = randomPrizeIndex; // Lưu vào ref

    const degreesPerPrize = 360 / prizeCount;

    // Tính toán tọa độ góc xoay chuẩn xác (Quay ít nhất 10 vòng + góc target)
    const targetAngle = 3600 + (360 - randomPrizeIndex * degreesPerPrize - degreesPerPrize / 2);
    setRotation((prev) => prev + targetAngle);

    // Chuẩn chỉnh đồng hồ bấm giờ đúng 10 giây (10000ms) khớp hoàn toàn với CSS transition
    setTimeout(() => {
      // TẮT NHẠC NGAY LẬP TỨC KHI VÒNG QUAY KHỰNG LẠI
      audioQuay.pause();
      audioQuay.currentTime = 0;

      setIsSpinning(false);

      // Lấy kết quả phần thưởng từ ref ra và gửi lên App.jsx xử lý
      const finalPrizeIndex = currentPrizeIndexRef.current;
      if (onWin && prizes[finalPrizeIndex]) {
        onWin(prizes[finalPrizeIndex].text);
      }
    }, 13000); // Đã đồng bộ chuẩn 10 giây hành trình nhân phẩm nhen ní!
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "25px",
        padding: "10px",
        userSelect: "none",
      }}
    >
      {/* KHUNG VIỀN NGOÀI NỔI KHỐI 3D */}
      <div
        style={{
          position: "relative",
          width: "320px",
          height: "320px",
          padding: "12px",
          borderRadius: "50%",
          background: "linear-gradient(145deg, #f43f5e, #be123c)",
          boxShadow:
            "inset 2px 2px 5px rgba(255,255,255,0.4), inset -2px -2px 5px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* MŨI TÊN ĐỊNH VỊ ĐỈNH 12 GIỜ CHUẨN XÁC */}
        <div
          style={{
            position: "absolute",
            top: "-15px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "0",
            height: "0",
            borderLeft: "18px solid transparent",
            borderRight: "18px solid transparent",
            borderTop: "32px solid #f43f5e",
            filter: "drop-shadow(0px 4px 5px rgba(0,0,0,0.3))",
            zIndex: 30,
          }}
        />

        {/* THÂN BÁNH XE XOAY MƯỢT 10 GIÂY CHUẨN CUBIC-BEZIER */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            position: "relative",
            overflow: "hidden",
            transition: 'transform 13s cubic-bezier(0.1, 0.8, 0.1, 1)',
            transform: `rotate(${rotation}deg)`,
            background:
              prizes.length > 0
                ? `conic-gradient(${prizes.map((p, i) => `${p.color} ${i * (360 / prizes.length)}deg ${(i + 1) * (360 / prizes.length)}deg`).join(", ")})`
                : "#f43f5e",
          }}
        >
          {/* Vẽ các nan chia ô màu */}
          {prizes.map((_, i) => (
            <div
              key={`line-${i}`}
              style={{
                position: "absolute",
                width: "2px",
                height: "50%",
                top: 0,
                left: "50%",
                backgroundColor: "rgba(255,255,255,0.4)",
                transformOrigin: "bottom center",
                transform: `translateX(-50%) rotate(${i * (360 / prizes.length)}deg)`,
                zIndex: 2,
              }}
            />
          ))}

          {/* Căn chỉnh chữ hiển thị lọt lòng gọn gàng trong ô */}
          {prizes.map((p, i) => (
            <div
              key={`text-${i}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                transform: `rotate(${i * (360 / prizes.length) + 360 / prizes.length / 2}deg)`,
                display: "flex",
                justifyContent: "center",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  paddingTop: "24px",
                  width: "70px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#374151",
                  textShadow: "0 0 2px rgba(255,255,255,0.8)",
                  lineHeight: "1.3",
                  wordWrap: "break-word",
                  whiteSpace: "normal"
                }}
              >
                {p.text}
              </div>
            </div>
          ))}
        </div>

        {/* TÂM TRỤC TRÒN TRÁI TIM CHÂN THỰC */}
        <div
          style={{
            position: "absolute",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #ffffff 0%, #cbd5e1 70%, #94a3b8 100%)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 25,
            border: "3px solid #fff",
          }}
        >
          <span style={{ fontSize: "16px" }}>❤️</span>
        </div>
      </div>

      {/* NÚT BẤM REALTIME ĐỒNG BỘ CHI PHÍ */}
      <button
        onClick={handleSpin}
        disabled={isSpinning || prizes.length === 0}
        style={{
          padding: "12px 35px",
          backgroundColor: isSpinning ? "#cbd5e1" : "#f43f5e",
          color: "white",
          border: "none",
          borderRadius: "25px",
          fontWeight: "bold",
          fontSize: "15px",
          cursor: isSpinning ? "not-allowed" : "pointer",
          boxShadow: isSpinning ? "none" : "0 6px 16px rgba(244,63,94,0.4), inset 0 -4px 0 rgba(0,0,0,0.15)",
          transition: "all 0.1s ease",
          transform: isSpinning ? "translateY(3px)" : "none"
        }}
      >
        {isSpinning
          ? "🎲 Đang thử vận may..."
          : `🎡 Quay Nhân Phẩm (${spinCost} phiếu)`}
      </button>
    </div>
  );
}