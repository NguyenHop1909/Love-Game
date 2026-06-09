import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { supabase } from "./supabaseClient";

export default function AdminGiftManager() {
    const [allGifts, setAllGifts] = useState([]);
    const [filterStatus, setFilterStatus] = useState("all"); // all, unused, used
    const [loading, setLoading] = useState(true);

    // 1. Hàm tải toàn bộ danh sách quà của tất cả người dùng về cho Admin
    const fetchAllGifts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("user_inventory")
                .select("*")
                .order("created_at", { ascending: false }); // Quà mới nhất nằm lên đầu

            if (error) throw error;
            setAllGifts(data || []);
        } catch (error) {
            console.error("Lỗi Admin lấy danh sách quà:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllGifts();

        // Lắng nghe Real-time: User quay trúng hoặc xài quà là Admin thấy liền
        const channel = supabase
            .channel("admin_inventory_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "user_inventory" },
                () => {
                    fetchAllGifts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 2. Hàm xử lý khi Admin muốn Xóa/Thu hồi một món quà
    const handleDeleteGift = async (giftId, giftName) => {
        const result = await Swal.fire({
            title: "Xác nhận thu hồi? 🚨",
            text: `Ní chắc chắn muốn xóa món quà [${giftName}] này khỏi kho đồ của người yêu không?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Xóa thẳng tay! 🔥",
            cancelButtonText: "Hủy bỏ"
        });

        if (result.isConfirmed) {
            try {
                const { error } = await supabase
                    .from("user_inventory")
                    .delete()
                    .eq("id", giftId);

                if (error) throw error;

                Swal.fire("Đã thu hồi!", `Món quà [${giftName}] đã bị xóa thành công.`, "success");
                fetchAllGifts();
            } catch (error) {
                Swal.fire("Thất bại!", error.message, "error");
            }
        }
    };

    // 3. Tính toán số liệu thống kê nhanh
    const totalCount = allGifts.length;
    const unusedCount = allGifts.filter((g) => g.status === "Chưa sử dụng").length;
    const usedCount = allGifts.filter((g) => g.status === "Đã sử dụng").length;

    // 4. Lọc danh sách hiển thị dựa theo bộ lọc được chọn
    const filteredGifts = allGifts.filter((gift) => {
        if (filterStatus === "unused") return gift.status === "Chưa sử " || gift.status === "Chưa sử dụng";
        if (filterStatus === "used") return gift.status === "Đã sử dụng";
        return true; // "all"
    });

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "700px",
                background: "#f8fafc",
                borderRadius: "20px",
                padding: "25px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                border: "1px solid #e2e8f0",
                fontFamily: "sans-serif",
                margin: "20px auto"
            }}
        >
            <h2 style={{ textAlign: "center", color: "#1e293b", fontSize: "22px", marginBottom: "5px" }}>
                ⚙️ Bảng Quản Lý Quà Tặng (Admin Panel)
            </h2>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#64748b", marginBottom: "25px" }}>
                Theo dõi trạng thái, phê duyệt và điều phối kho quà thời gian thực
            </p>

            {/* Khu vực thống kê nhanh */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "25px" }}>
                <div style={{ background: "#e0f2fe", padding: "15px", borderRadius: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#0369a1", fontWeight: "bold" }}>Tổng Quà Đã Trúng</div>
                    <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0284c7", marginTop: "5px" }}>{totalCount}</div>
                </div>
                <div style={{ background: "#fef08a", padding: "15px", borderRadius: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#a16207", fontWeight: "bold" }}>Chờ Đổi Đời Thực</div>
                    <div style={{ fontSize: "24px", fontWeight: "bold", color: "#b45309", marginTop: "5px" }}>{unusedCount}</div>
                </div>
                <div style={{ background: "#bbf7d0", padding: "15px", borderRadius: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "#15803d", fontWeight: "bold" }}>Đã Trao Tay</div>
                    <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a", marginTop: "5px" }}>{usedCount}</div>
                </div>
            </div>

            {/* Thanh bộ lọc dữ liệu */}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
                <button
                    onClick={() => setFilterStatus("all")}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: "none",
                        fontWeight: "bold",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: filterStatus === "all" ? "#1e293b" : "#e2e8f0",
                        color: filterStatus === "all" ? "white" : "#475569"
                    }}
                >
                    Tất cả ({totalCount})
                </button>
                <button
                    onClick={() => setFilterStatus("unused")}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: "none",
                        fontWeight: "bold",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: filterStatus === "unused" ? "#d97706" : "#e2e8f0",
                        color: filterStatus === "unused" ? "white" : "#475569"
                    }}
                >
                    Chưa sử dụng ({unusedCount})
                </button>
                <button
                    onClick={() => setFilterStatus("used")}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: "none",
                        fontWeight: "bold",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: filterStatus === "used" ? "#16a34a" : "#e2e8f0",
                        color: filterStatus === "used" ? "white" : "#475569"
                    }}
                >
                    Đã sử dụng ({usedCount})
                </button>
            </div>

            {/* Danh sách quà quản lý chi tiết */}
            {loading ? (
                <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px" }}>⏳ Đang tải kho quà hệ thống...</p>
            ) : filteredGifts.length === 0 ? (
                <p style={{ textAlign: "center", color: "#94a3b8", padding: "30px 0", fontSize: "14px" }}>
                    Không tìm thấy món quà nào thuộc danh mục này!
                </p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "350px", overflowY: "auto" }}>
                    {filteredGifts.map((gift) => {
                        const isUsed = gift.status === "Đã sử dụng";
                        return (
                            <div
                                key={gift.id}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "12px 15px",
                                    background: "white",
                                    borderRadius: "12px",
                                    border: "1px solid #e2e8f0",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: "bold", fontSize: "14px", color: "#334155" }}>
                                        🎁 {gift.prize_text}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                                        Thời gian: {new Date(gift.created_at).toLocaleString("vi-VN")}
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    {/* Badge trạng thái */}
                                    <span
                                        style={{
                                            padding: "5px 10px",
                                            borderRadius: "15px",
                                            fontSize: "11px",
                                            fontWeight: "bold",
                                            background: isUsed ? "#dcfce7" : "#fef9c3",
                                            color: isUsed ? "#15803d" : "#a16207"
                                        }}
                                    >
                                        {gift.status}
                                    </span>

                                    {/* Nút Thu hồi/Xóa */}
                                    <button
                                        onClick={() => handleDeleteGift(gift.id, gift.prize_text)}
                                        style={{
                                            padding: "6px 12px",
                                            background: "#fee2e2",
                                            color: "#ef4444",
                                            border: "none",
                                            borderRadius: "8px",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            transition: "all 0.2s"
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = "#ef4444";
                                            e.currentTarget.style.color = "white";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = "#fee2e2";
                                            e.currentTarget.style.color = "#ef4444";
                                        }}
                                    >
                                        Thu hồi 🗑️
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}