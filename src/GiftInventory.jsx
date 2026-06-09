import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { supabase } from "./supabaseClient";

export default function GiftInventory() {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Hàm tải danh sách quà từ Database về
    const fetchInventory = async () => {
        setLoading(true);
        try {
            // Vì hễ xài là xóa nên trong DB chỉ toàn quà chưa xài, cứ lấy hết ra nhen ní
            const { data, error } = await supabase
                .from("user_inventory")
                .select("*")
                .order("created_at", { ascending: false }); // Quà mới trúng xếp lên đầu

            if (error) throw error;
            setInventory(data || []);
        } catch (error) {
            console.error("Lỗi lấy túi quà:", error);
        } finally {
            setLoading(false);
        }
    };

    // Tự động tải quà khi mở trang và lắng nghe realtime khi có quà mới hoặc bị xóa
    useEffect(() => {
        fetchInventory();

        const channel = supabase
            .channel("inventory_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "user_inventory" },
                () => {
                    fetchInventory(); // Có biến động (thêm/xóa) là tự động load lại túi quà liền
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 2. Logic khi bấm nút "Sử dụng" món quà -> XOÁ LUÔN KHỎI DATABASE
    const handleUseGift = async (giftId, giftName) => {
        const result = await Swal.fire({
            title: "Xác nhận sử dụng? 🎁",
            text: `Ní muốn dùng món quà [${giftName}] này ngay bây giờ hả? (Món quà sẽ biến mất khỏi túi sau khi dùng nhen)`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Đúng rồi ní! ❤️",
            cancelButtonText: "Để dành tí quay lại"
        });

        if (result.isConfirmed) {
            try {
                // 👉 ĐÃ THAY ĐỔI: Chuyển từ .update() thành .delete() để xóa thẳng tay trên Supabase
                const { error } = await supabase
                    .from("user_inventory")
                    .delete()
                    .eq("id", giftId);

                if (error) throw error;

                Swal.fire({
                    title: "Sử dụng thành công! 🎉",
                    text: `Đã kích hoạt: ${giftName}. Hãy liên hệ Công chúa để nhận quà đời thực nhen!`,
                    icon: "success",
                    confirmButtonColor: "#ff85c0"
                });

                // Hàm fetchInventory() sẽ tự chạy lại nhờ cổng Realtime ở trên nên ní không lo bị delay giao diện nhé

            } catch (error) {
                Swal.fire("Lỗi rồi ní ơi!", error.message, "error");
            }
        }
    };

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "500px",
                background: "#fff0f6",
                borderRadius: "20px",
                padding: "20px",
                boxShadow: "0 10px 25px rgba(219, 39, 119, 0.1)",
                border: "2px dashed #f43f5e",
                fontFamily: "sans-serif",
                margin: "20px auto"
            }}
        >
            <h2
                style={{
                    textAlign: "center",
                    color: "#db2777",
                    fontSize: "20px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px"
                }}
            >
                🎒 Túi Đồ Tích Lũy Nhân Phẩm ({inventory.length})
            </h2>

            {loading ? (
                <p style={{ textAlign: "center", color: "#6b7280", fontSize: "14px" }}>🎒 Đang lục lọi túi đồ...</p>
            ) : inventory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#9ca3af" }}>
                    <span style={{ fontSize: "40px" }}>🏜️</span>
                    <p style={{ fontSize: "14px", marginTop: "10px" }}>Túi trống rỗng hà! Vòng quay nhân phẩm vẫy gọi ní ơi!</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto", paddingRight: "5px" }}>
                    {inventory.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "12px 15px",
                                background: "white",
                                borderRadius: "15px",
                                boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                                border: "1px solid #fbcfe8",
                                gap: "15px",
                                transition: "all 0.2s"
                            }}
                        >
                            {/* Tên Quà */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#1f2937" }}>
                                    ✨ {item.prize_text}
                                </div>
                                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                                    Trúng ngày: {new Date(item.created_at).toLocaleDateString("vi-VN")}
                                </div>
                            </div>

                            {/* Nút Bấm Sử dụng */}
                            <div>
                                <button
                                    onClick={() => handleUseGift(item.id, item.prize_text)}
                                    style={{
                                        padding: "8px 16px",
                                        background: "linear-gradient(135deg, #ec4899, #db2777)",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "20px",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        boxShadow: "0 4px 10px rgba(219,39,119,0.3)",
                                        transition: "transform 0.1s"
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                                    onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                >
                                    Sử dụng 🚀
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}