import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';
import Swal from 'sweetalert2';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ChartSummary from './ChartSummary';
import ButtonCute from './ButtonCute';
import CuteLoading from './CuteLoading';
import LuckyWheel from './LuckyWheel'; // Import component Vòng Quay Nhân Phẩm

function App() {
  const navigate = useNavigate();

  // --- HỆ THỐNG ĐĂNG NHẬP NỘI BỘ ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('is_logged_in') === 'true');
  const [role, setRole] = useState(() => localStorage.getItem('user_role') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- BIẾN CHO PHẦN KAHOOT ---
  const [kahootLink, setKahootLink] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [messageAdmin, setMessageAdmin] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [scores, setScores] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});
  const [loadingUser, setLoadingUser] = useState(false);

  // --- BIẾN CHO PHẦN THƯỞNG PHẠT + LÍ DO ---
  const [rewardsPenalties, setRewardsPenalties] = useState([]);
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [reason, setReason] = useState(''); // Ô nhập chung ở giao diện
  const [loadingTicket, setLoadingTicket] = useState(false);

  // --- BIẾN ĐỂ TÍNH TOÁN QUY ĐỔI CHO USER ---
  const [loadingExchange, setLoadingExchange] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // --- SHOW AUDIT LOGS (CHỈ ADMIN) ---
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // --- HÀM CẬP NHẬT VÒNG QUAY (Admin dùng) ---
  const [prizes, setPrizes] = useState([{ text: '' }]);
  const [newSpinCost, setNewSpinCost] = useState(2);

  // Đọc cấu hình bảo mật từ file .env
  const idTeleCuaAnh = import.meta.env.VITE_TELE_CHAT_ID_ANH;
  const idTeleCuaEm = import.meta.env.VITE_TELE_CHAT_ID_EM;
  const teleBotToken = import.meta.env.VITE_TELE_BOT_TOKEN;

  // --- 2. LOAD CÀI ĐẶT VÒNG QUAY TỪ DATABASE KHI COMPONENT MOUNT ---
  useEffect(() => {
    const loadCurrentSettings = async () => {
      const { data } = await supabase.from('wheel_settings').select('*').eq('id', 1).single();
      if (data) {
        setNewSpinCost(data.spin_cost);
        // SỬA CHỖ NÀY: Thay vì join chuỗi, mình set thẳng mảng vào prizes
        setPrizes(data.prizes && data.prizes.length > 0 ? data.prizes : [{ text: '' }]);
      }
    };
    loadCurrentSettings();
  }, []);
  // --- CÁC HÀM XỬ LÝ (Ní dán vào đây) ---
  const addPrize = () => setPrizes([...prizes, { text: '' }]);

  const removePrize = (index) => {
    if (prizes.length > 1) setPrizes(prizes.filter((_, i) => i !== index));
  };

  const updatePrize = (index, value) => {
    const newArr = [...prizes];
    newArr[index].text = value;
    setPrizes(newArr);
  };

  // --- 3. HÀM CẬP NHẬT (Dùng cho nút bấm) ---
  const updateWheelSettings = async () => {
    try {
      // 1. Lọc bỏ các dòng trắng
      const validPrizes = prizes.filter(p => p.text.trim() !== "");
      if (validPrizes.length === 0) throw new Error("Nhập ít nhất 1 phần thưởng nhen ní!");

      // 2. Gán màu tự động
      const colors = ['#ff9aa2', '#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#f8d7da', '#d1e7dd'];
      const formattedPrizes = validPrizes.map((p, index) => ({
        text: p.text,
        color: colors[index % colors.length]
      }));

      // 3. Gửi thẳng lên Supabase
      const { error } = await supabase.from('wheel_settings').update({
        prizes: formattedPrizes,
        spin_cost: parseInt(newSpinCost) || 0
      }).eq('id', 1);

      if (error) throw error;
      Swal.fire('Thành công! ✨', 'Vòng quay đã được cập nhật!', 'success');
    } catch (e) {
      Swal.fire('Lỗi rồi ní ơi!', e.message, 'error');
    }
  };

  // --- 🔥 HÀM XỬ LÝ KẾT QUẢ VÒNG QUAY MAY MẮN ---
  const handleLuckyWheelWin = async (prizeText) => {
    try {
      audioQuay.play().catch(err => console.log("Trình duyệt chặn phát tự động, chờ tương tác:", err));
    } catch (e) {
      console.warn("Chưa load được nhạc ní ơi:", e);
    }
    setLoadingExchange(true);
    try {
      const soPhieuTieuHao = 2; // Số phiếu dùng để quay theo yêu cầu của ní
      const ngayHomNay = new Date().toISOString().split('T')[0];
      const reasonText = `🎰 Vòng quay nhân phẩm: Trúng [${prizeText}]`;

      // BƯỚC 1: TRỪ 2 ĐIỂM VÀO TỔNG PHIẾU THƯỞNG (Ghi nhận số âm vào bảng chính)
      const { data: insertedData, error: dbError } = await supabase
        .from('rewards_penalties')
        .insert([{
          date: ngayHomNay,
          penalty_amount: 0,
          reward_amount: -soPhieuTieuHao, // Trừ 2 phiếu thưởng
          reward_reason: reasonText,
        }])
        .select(); // Thêm .select() để lấy ID dòng vừa tạo nhằm phục vụ ghi log

      if (dbError) throw dbError;

      // BƯỚC 3: GHI LOG TRỪ VÀO SỔ ĐẦU BÀI THƯỞNG PHẠT (Bảng audit_logs)
      if (insertedData && insertedData.length > 0) {
        const logMsg = `Anh yêu đã dùng ${soPhieuTieuHao} phiếu để quay vòng quay. Kết quả: Trúng [${prizeText}]`;
        await logAction('INSERT', insertedData[0].id, logMsg);
      }

      // BƯỚC 2: BÁO BÊN TELEGRAM CHO BÉ YÊU RẰNG MÌNH MỚI DÙNG 2 PHIẾU ĐỂ QUAY
      const tinNhanTele = `🎰 *TÍN HIỆU THỬ THÁCH NHÂN PHẨM!* 🎰\n\n` +
        `Anh người yêu vừa tiêu hao *${soPhieuTieuHao} Phiếu Thưởng* để thử vận may với Vòng Quay.\n\n` +
        `🎯 *Kết quả quay trúng:* \n👉 *${prizeText}* 👈\n\n` +
        `Công chúa chuẩn bị tinh thần xử lý phần thưởng/hình phạt này cho người ta nhé! 😂💕`;

      // Gửi tin nhắn đến Telegram của Em yêu
      await callTelegramAPI(idTeleCuaEm, tinNhanTele);

      // BƯỚC 4: HIỆN POPUP THÔNG BÁO CHO NGƯỜI QUAY
      await Swal.fire({
        title: 'Vòng quay dừng lại rồi! 🎉',
        html: `<p style="font-size: 16px; font-weight: bold; color: #db2777;">✨ Kết quả: ${prizeText} ✨</p>` +
          `<p style="font-size: 13px;">Hệ thống đã trừ ${soPhieuTieuHao} phiếu, ghi log Sổ đầu bài và báo cáo trực tiếp cho Công chúa qua Telegram rồi nhen ní!</p>`,
        icon: 'success',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
        confirmButtonText: 'Chấp nhận số phận! 🧸'
      });

      // Reset và tải lại dữ liệu điểm mới nhất lên giao diện
      await fetchData();
    } catch (error) {
      console.error("Lỗi vòng quay:", error);
      Swal.fire('Lỗi vòng quay rồi ní ơi!', error.message, 'error');
    } finally {
      setLoadingExchange(false);
    }
  };

  const getLogMessage = (oldData, newData) => {
    // oldData và newData là object chứa { amount: 111, type: 'thưởng' }
    const oldText = `${oldData.amount} điểm ${oldData.type}`;
    const newText = `${newData.amount} điểm ${newData.type}`;

    return `Sửa từ ${oldText} --> ${newText}`;
  };

  const logAction = async (actionType, targetId, details) => {
    try {
      await supabase.from('audit_logs').insert([
        {
          admin_name: "Em bé yêu",
          action_type: actionType,
          target_id: targetId,
          action_details: details
        }
      ]);
    } catch (error) {
      console.error("Lỗi log hành động:", error);
    }
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setAuditLogs(data); // Chỉ cập nhật dữ liệu, KHÔNG TOGGLE
    }
  };

  const chartData = [...rewardsPenalties]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // Dùng created_at cho chắc chắn
    .map(item => ({
      date: item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'N/A',
      reward: Number(item.reward_amount) || 0,
      penalty: Math.abs(Number(item.penalty_amount)) || 0
    }));

  const handleDeleteQuiz = async (id) => {
    const result = await Swal.fire({
      title: 'Ơ kìa, Công chúa muốn xóa bài này hả? 👑',
      text: 'Công chúa chắc chưa đó? Xóa cái này là anh người yêu không có bài để làm đâu, Công chúa suy nghĩ kỹ chưa nè... 🧸✨',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ff85c0', // Hồng phấn
      cancelButtonColor: '#ffcce6', // Hồng nhạt
      confirmButtonText: 'Đúng rồi, xóa đi! ✨',
      cancelButtonText: 'Thôi, để đó cho anh yêu làm! 💖',
      background: '#fff0f6',
      customClass: {
        popup: 'rounded-3xl'
      }
    });


    if (result.isConfirmed) {
      await supabase.from('quizzes').delete().eq('id', id);
      fetchData();
      Swal.fire({
        title: 'Đã xóa theo ý Công chúa! 🪄',
        text: 'Công chúa đúng là nghiêm khắc quá đi thôi, cơ mà anh yêu chắc sợ xanh mặt rồi! 🥰',
        icon: 'success',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
        confirmButtonText: 'Tuân lệnh Công chúa! ✨'
      });
    }
  };

  const handleEditQuiz = async (quiz) => {
    const { value: formValues } = await Swal.fire({
      title: 'Công chúa muốn thay đổi thử thách?',
      html:
        `<label style="color: #db2777; font-weight: bold;">Link Kahoot mới nè:</label>` +
        `<input id="swal-link-input" class="swal2-input" value="${quiz.link_kahoot}" placeholder="Dán link mới vào đây nha...">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Đổi luôn đi! ✨',
      cancelButtonText: 'Thôi, để vậy đi 💖',
      background: '#fff0f6', // Màu hồng pastel xinh xắn
      confirmButtonColor: '#db2777',
      preConfirm: () => {
        const link = document.getElementById('swal-link-input')?.value;
        if (!link) {
          Swal.showValidationMessage('Công chúa chưa nhập link kìa! 🥺');
          return false;
        }
        return { link };
      }
    });

    if (formValues) {
      try {
        await supabase.from('quizzes')
          .update({ link_kahoot: formValues.link })
          .eq('id', quiz.id);

        fetchData();
        Swal.fire({
          title: 'Đã cập nhật xong! 🪄',
          text: 'Công chúa thay đổi thử thách rồi, anh yêu chuẩn bị tinh thần đi là vừa! 🥰',
          icon: 'success',
          confirmButtonColor: '#db2777',
          background: '#fff0f6'
        });
      } catch (error) {
        Swal.fire('Hỏng rồi Công chúa ơi!', error.message, 'error');
      }
    }
  };
  // --- HÀM GỬI TIN NHẮN TELEGRAM ---
  const callTelegramAPI = async (chatId, textMessage) => {
    if (!teleBotToken || !chatId) {
      console.warn("Thiếu cấu hình Token hoặc Chat ID trong file .env ní ơi!");
      return;
    }
    try {
      const url = `https://api.telegram.org/bot${teleBotToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: textMessage, parse_mode: 'Markdown' })
      });
    } catch (err) {
      console.error("Lỗi API Telegram:", err);
    }
  };

  // --- XỬ LÝ ĐĂNG NHẬP + ĐIỀU HƯỚNG TỰ ĐỘNG ---
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    // Dùng .toLowerCase() để không phân biệt hoa thường
    const user = username.trim().toLowerCase();
    const pass = password;

    if (user === 'anhyeu' && pass === '0212') {
      setIsLoggedIn(true);
      setRole('admin');
      localStorage.setItem('is_logged_in', 'true');
      localStorage.setItem('user_role', 'admin');
      navigate('/admin');
    } else if (user === 'emyeu' && pass === '0212') {
      setIsLoggedIn(true);
      setRole('user');
      localStorage.setItem('is_logged_in', 'true');
      localStorage.setItem('user_role', 'user');
      navigate('/user');
    } else {
      // Tách biệt thông báo cho từng người
      if (user === 'anhyeu') {
        setLoginError('❌ Anh yêu à, sai mật khẩu rồi kìa! Nhập lại cho Công chúa nha! 👑');
      } else if (user === 'anhyeu') {
        setLoginError('❌ Công chúa ơi, sai mật khẩu rồi! Kiểm tra lại nè! 🧸');
      } else {
        setLoginError('❌ Tên đăng nhập hoặc mật khẩu không đúng rồi ní ơi! 💕');
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole('');
    localStorage.clear();
    navigate('/');
  };

  // Tải dữ liệu tổng hợp từ Database Supabase về
  const fetchData = async () => {
    try {
      const { data: qData } = await supabase.from('quizzes').select('*').order('id', { ascending: false });
      setQuizzes(qData || []);

      const { data: rpData } = await supabase
        .from('rewards_penalties')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      setRewardsPenalties(rpData || []);

      if (rpData) {
        // 1. Tính tổng thực tế (Thưởng - Phạt)
        const currentTotal = rpData.reduce((acc, item) => acc + (Number(item.reward_amount) || 0) - (Number(item.penalty_amount) || 0), 0);

        // 2. LOGIC BONUS: Nếu đúng bằng 9 thì cộng thêm 1 thành 10
        const bonus = (currentTotal === 9) ? 1 : 0;
      }
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error.message);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return; // Chỉ chạy khi đã login

    // Hàm khởi tạo dữ liệu ban đầu
    const initApp = async () => {
      setLoadingInitial(true);
      await Promise.all([fetchData(), fetchLogs()]);
      setLoadingInitial(false);
    };

    initApp();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards_penalties' }, payload => {
        console.log('Realtime nhận được:', payload);

        if (payload.eventType === 'INSERT') {
          // Kiểm tra xem payload.new có đủ dữ liệu không
          if (payload.new) {
            setRewardsPenalties(prev => {
              // Kiểm tra trùng lặp ID để tránh hiện 2 dòng
              if (prev.find(item => item.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          setRewardsPenalties(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
        } else if (payload.eventType === 'DELETE') {
          setRewardsPenalties(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    // 2. THÊM KÊNH CHO BẢNG AUDIT_LOGS
    const auditChannel = supabase
      .channel('audit-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, payload => {
        // payload.new chính là dòng log vừa được thêm vào DB
        setAuditLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(auditChannel);
    };
  }, [isLoggedIn]);


  // Tính tổng điểm từ database trước
  const rawTotal = rewardsPenalties.reduce((sum, item) => {
    return sum + Number(item.reward_amount || 0) - Number(item.penalty_amount || 0);
  }, 0);

  // Sau đó tính totalRewards sau khi đã áp dụng "cơ chế nhân đạo"
  const totalRewards = (rawTotal === 9) ? 10 : rawTotal;

  // Cuối cùng tính các biến ví dựa trên totalRewards đã được xử lý
  const honthuong = totalRewards < 0 ? 0 : totalRewards;
  const soHunSau = totalRewards < 0 ? 0 : Math.floor(totalRewards / 50);
  const soHunMoi = totalRewards < 0 ? 0 : Math.floor((totalRewards % 50) / 10);

  // --- 🔥 HÀM ĐỔI QUÀ ĐÃ FIX CUTE + ĐỒNG BỘ TELEGRAM 🔥 ---
  const handleExchangeGift = async (type) => {
    // Nếu điểm nhỏ hơn hoặc bằng 0, nổ ngay popup thông báo hồng phấn siêu cute
    if (totalRewards <= 0) {
      Swal.fire({
        title: 'Hết sạch phiếu rồi ní ơi! 💀',
        text: `Ví hiện tại đang bị âm hoặc trống rỗng (${totalRewards} phiếu). Mau đi làm Kahoot nộp bài kiếm thêm phiếu thưởng nha! 🧸`,
        icon: 'error',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
        confirmButtonText: 'Đồng ý, đi cày điểm liền! ✨',
        customClass: {
          popup: 'rounded-2xl'
        }
      });
      return;
    }

    if (type === 'HUN_MOI') {
      if (totalRewards < 10) {
        Swal.fire({
          title: 'Hụt quà rồi ní ơi! 😢',
          text: `Cần ít nhất 10 phiếu thưởng, ní hiện tại mới tích được ${totalRewards} phiếu thui nà!`,
          icon: 'warning',
          confirmButtonColor: '#ff4d94'
        });
        return;
      }

      const result = await Swal.fire({
        title: 'Đổi quà ngọt ngào nhé! 💋',
        text: 'Ní chắc chắn muốn tiêu hao 10 phiếu thưởng để lấy 1 cái "Hun Môi" ngọt lịm này chứ? ✨',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ff85c0',
        cancelButtonColor: '#ffcce6',
        confirmButtonText: 'Đổi liền tay, yêu ngay! 💖',
        cancelButtonText: 'Thôi, để dành tích tiếp 🧸',
        background: '#fff0f6',
        customClass: {
          popup: 'rounded-3xl'
        },
      });

      if (!result.isConfirmed) return;

      setLoadingExchange(true);
      try {
        // 1. Tạo lý do tự động thật ngọt ngào
        const reasonText = `Đổi quà: ${currentGift.title} (Từ anh bé dễ thương)`;
        const { error } = await supabase.from('rewards_penalties').insert([{
          date: new Date().toISOString().split('T')[0],
          penalty_amount: 0,
          reward_amount: -10,
          reward_reason: reasonText,
        }]);
        if (error) throw error;

        await callTelegramAPI(idTeleCuaEm, `🚨 *TÍN HIỆU ĐỔI QUÀ TỪ ANH NGƯỜI YÊU!* 🚨\n\nEm yêu ơi! Anh ấy vừa đổi thành công *10 Phiếu Thưởng* để nhận: \n💋 *1 CÁI HUN MÔI CHÍNH HIỆU* 💋\n\nCông Chúa của anh chuẩn bị "thanh toán" phần thưởng nóng hổi cho người ta đi kìa bé ơi! 🥰`);

        await Swal.fire({
          title: 'Đổi quà thành công! 🎉',
          text: 'Bot đã bắn tin nhắn đòi Hun Môi đến Telegram em yêu rồi nhé. Chuẩn bị tinh thần nhận quà thôi ní ơi! 💋',
          icon: 'success',
          confirmButtonColor: '#ff85c0',
          background: '#fff0f6',
          confirmButtonText: 'Đã rõ, chờ tí nhé! ✨'
        });
        fetchData();
      } catch (error) {
        Swal.fire({
          title: 'Lỗi hệ thống rồi ní ơi! 🥺',
          text: 'Có chút trục trặc nhỏ: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#ff85c0',
          background: '#fff0f6'
        });
      } finally {
        setLoadingExchange(false);
      }
    }

    if (type === 'HUN_SAU') {
      if (totalRewards < 50) {
        Swal.fire({
          title: 'Chưa đủ đô ní ơi! 🌋',
          text: `Cần tích lũy 50 phiếu thưởng để đổi Hun Sâu bự chà bá, ní mới có ${totalRewards} phiếu hà!`,
          icon: 'warning',
          confirmButtonColor: '#7c3aed'
        });
        return;
      }

      const result = await Swal.fire({
        title: 'Chơi lớn luôn nè! 🔥',
        text: 'Ní muốn tiêu hao hẳn 50 phiếu thưởng để đổi lấy 1 cái Hun Sâu siêu cấp cháy bỏng đúng không? Quà bự lắm á nha!',
        icon: 'heart',
        showCancelButton: true,
        confirmButtonColor: '#ff85c0',
        cancelButtonColor: '#ffcce6',
        confirmButtonText: 'Chốt đơn, hun cái nào! 💋',
        cancelButtonText: 'Để suy nghĩ lại... 🧸',
        background: '#fff0f6',
        customClass: {
          popup: 'rounded-2xl'
        }
      });

      if (!result.isConfirmed) return;

      setLoadingExchange(true);
      try {
        const { error } = await supabase.from('rewards_penalties').insert([{
          date: new Date().toISOString().split('T')[0],
          penalty_amount: 0,
          reward_amount: -50
        }]);
        if (error) throw error;

        await callTelegramAPI(idTeleCuaEm, `🔥 *CẢNH BÁO NGUY HIỂM: ANH NGƯỜI YÊU CHƠI LỚN!* 🔥\n\nÚi chu cha! Anh người yêu vừa "đập hộp" tiêu hao hẳn 50 Phiếu Thưởng để đổi lấy đặc quyền tối cao: \n🌋 *1 CÁI HUN SÂU ĐẬM SÂU CHÁY BỎNG* 🌋\n\nTình huống vô cùng khẩn cấp, em yêu chuẩn bị tinh thần đón nhận "tấn công" ngọt ngào đi nhé! 🥰`);

        await Swal.fire({
          title: 'Báo động đỏ khẩn cấp! 🌋',
          text: "Đã phát tín hiệu Hotline 'khẩn cấp' qua máy Bé Yêu! Quà này siêu chất lượng nha!",
          icon: 'success',
          confirmButtonColor: '#ff85c0',
          background: '#fff0f6',
          confirmButtonText: 'Hóng quá đi nè! ✨',
          customClass: {
            popup: 'rounded-2xl'
          }
        });
        fetchData();
      } catch (error) {
        Swal.fire({
          title: 'Lỗi hệ thống rồi ní ơi! 🥺',
          text: error.message,
          icon: 'error',
          confirmButtonColor: '#ff85c0',
          background: '#fff0f6',
          customClass: {
            popup: 'rounded-2xl'
          }
        });
      } finally { setLoadingExchange(false); }
    }
  };

  // --- QUẢN LÝ THỬ THÁCH KAHOOT ---
  const handleSendQuiz = async (e) => {
    e.preventDefault();
    if (!kahootLink.trim()) {
      Swal.fire('Ơ kìa em yêu! 💕', 'Dán cái link Kahoot vào đã chứ nè!', 'info');
      return;
    }
    setLoadingAdmin(true); setMessageAdmin('');
    try {
      const { error } = await supabase.from('quizzes').insert([{ link_kahoot: kahootLink, status: 'PENDING' }]);
      if (error) throw error;

      await callTelegramAPI(idTeleCuaAnh, `🔥 *BÉ YÊU GỬI THỬ THÁCH MỚI!* 🔥\n\nNí ơi, người yêu vừa ra đề bài Kahoot mới tinh nè. Vào chiến ngay kẻo bị ăn phạt nha ní găm!\n🔗 *Link làm bài:* ${kahootLink}`);

      setMessageAdmin('🎉 Đã gửi thử thách thành công và báo Hot-line cho anh người yêu rồi em yêu nhé!');
      setKahootLink(''); fetchData();
    } catch (error) { setMessageAdmin('❌ Lỗi: ' + error.message); }
    finally { setLoadingAdmin(false); }
  };

  // --- USER NỘP BÀI MINH CHỨNG ---
  const handleSubmitScore = async (quizId) => {
    const diemSo = scores[quizId];
    const fileAnh = selectedFiles[quizId];
    if (diemSo === undefined || diemSo === '') {
      Swal.fire('Thiếu điểm ní ơi! 😂', 'Nhập điểm số Kahoot vào đã nào!', 'warning');
      return;
    }
    if (!fileAnh) {
      Swal.fire('Ủa bằng chứng đâu? 📸', 'Thiếu ảnh chụp màn hình chứng minh kìa ní ơi!', 'warning');
      return;
    }
    setLoadingUser(true);
    try {
      const fileExt = fileAnh.name.split('.').pop();
      const fileName = `${quizId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('quiz-images').upload(fileName, fileAnh);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('quizzes').update({ score: parseInt(diemSo), status: 'COMPLETED' }).eq('id', quizId);
      if (dbError) throw dbError;

      await callTelegramAPI(idTeleCuaEm, `✅ *ANH NGƯỜY YÊU ĐÃ HOÀN THÀNH BÀI!* ✅\n\n🎯 *Điểm số đạt được:* ${diemSo} điểm!\n📸 *Ảnh chụp bằng chứng:* ${publicUrl}`);

      Swal.fire('Nộp bài thành công! 🥳', 'Bot đã báo cáo kèm ảnh bằng chứng rõ ràng cho Bé Yêu rồi nhé!', 'success');
      fetchData();
    } catch (error) { Swal.fire('Lỗi nộp bài!', error.message, 'error'); }
    finally { setLoadingUser(false); }
  };

  // --- THÊM PHIẾU THƯỞNG PHẠT THỰC TẾ TRÊN ADMIN ---
  const handleAddTicket = async (e) => {
    e.preventDefault();
    const parsedPenalty = parseInt(penaltyAmount) || 0;
    const parsedReward = parseInt(rewardAmount) || 0;

    if (parsedPenalty === 0 && parsedReward === 0) {
      Swal.fire({
        title: 'Ơ kìa Công Chúa ơi! 👑💕',
        text: 'Cục cưng ơi, phải tăng hoặc giảm ít nhất 1 phiếu thưởng hoặc phạt rồi hãy bấm nộp chứ nà!',
        icon: 'info',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
      });
      return;
    }

    setLoadingTicket(true);

    const textReason = reason.trim() || null;
    const finalRewardReason = parsedReward !== 0 ? textReason : null;
    const finalPenaltyReason = parsedPenalty !== 0 ? textReason : null;

    try {
      // 1. Thêm dữ liệu vào bảng chính (thêm .select() để lấy lại ID vừa tạo)
      const { data, error } = await supabase.from('rewards_penalties').insert([{
        date: inputDate,
        penalty_amount: parsedPenalty,
        reward_amount: parsedReward,
        reward_reason: finalRewardReason,
        penalty_reason: finalPenaltyReason
      }]).select(); // <--- Rất quan trọng, phải có .select() thì mới lấy được ID

      if (error) throw error;

      // 2. GHI LOG NGAY SAU KHI THÊM THÀNH CÔNG
      let logMsg = "";
      const reasonText = textReason || 'Không có';

      if (parsedReward > 0 && parsedPenalty === 0) {
        // Chỉ có thưởng
        logMsg = `Em yêu đã thêm ${parsedReward} phiếu thưởng, Lí do: ${reasonText}`;
      } else if (parsedPenalty > 0 && parsedReward === 0) {
        // Chỉ có phạt
        logMsg = `Em yêu đã thêm ${parsedPenalty} phiếu phạt, Lí do: ${reasonText}`;
      } else {
        // Hỗn hợp cả hai
        logMsg = `Em yêu đã thêm ${parsedReward} phiếu thưởng : ${parsedPenalty} phạt, Lí do: ${reasonText}`;
      }

      await logAction('INSERT', data[0].id, logMsg);

      // 3. Thông báo và làm mới dữ liệu
      if (parsedReward > 0 && parsedPenalty === 0) {
        Swal.fire({
          title: 'Ting Ting! Phát Thưởng Thôi Nào! 🎉🎁',
          text: `Đã cộng thêm thành công ${parsedReward} phiếu vào ví rồi nha! Yêu Công Chúa lắm luôn đó, moah moah~ 💋✨`,
          icon: 'success',
          confirmButtonColor: '#4CAF50',
          background: '#f0fdf4', // Nền xanh lá dịu mát ngập tràn năng lượng tích cực
        });
      } else if (parsedPenalty > 0 && parsedReward === 0) {
        // 💀 THÔNG BÁO KHI CHỈ CÓ PHẠT (BUỒN HỜN DỖI)
        Swal.fire({
          title: 'Úi chu cha... Lên Sổ Đoạn Trường! 💀💔',
          text: `Nộp phiếu phạt -${parsedPenalty} điểm thành công! Ai biểu hư chi cho Công Chúa giận nè, lo mà sửa sai đi nha! 👿🔥`,
          icon: 'warning',
          confirmButtonColor: '#f44336',
          background: '#fff1f2', // Nền đỏ hồng nhẹ cảnh báo "nguy hiểm"
        });
      } else {
        // HỖN HỢP VỪA THƯỞNG VỪA PHẠT
        Swal.fire({
          title: 'Vừa Đấm Vừa Xoa Thành Công! ⚖️💕',
          text: `Đã ghi nhận +${parsedReward} thưởng và -${parsedPenalty} phạt vào sổ đầu bài rồi nhen em yêu!`,
          icon: 'success',
          confirmButtonColor: '#ff85c0',
          background: '#fff0f6',
        });
      }
      // Reset sau khi thành công
      setPenaltyAmount(0);
      setRewardAmount(0);
      setReason('');

      // 4. Gọi fetchData để cập nhật giao diện
      await fetchData();

    } catch (error) {
      Swal.fire({
        title: 'Huhu lỗi mất rồi cục cưng ơi! 🥺',
        text: 'Hệ thống hờn dỗi chút xíu rồi nè: ' + error.message,
        icon: 'error',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
      });
    } finally {
      setLoadingTicket(false);
    }
  };

  // --- XỬ LÝ XÓA PHIẾU THƯỞNG PHẠT (CHỈ ADMIN) ---
  // Ní đổi tham số từ 'id' thành 'item'
  const handleDeleteTicket = async (item) => {
    // 1. Xác nhận trước khi xóa
    const result = await Swal.fire({
      title: 'Xóa dòng này hả em yêu? 🥺',
      text: 'Em có chắc chắn muốn xóa dòng thưởng phạt này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff85c0',
      cancelButtonColor: '#ffcce6',
      confirmButtonText: 'Đúng rồi, xóa đi!',
      cancelButtonText: 'Hủy bỏ',
      background: '#fff0f6',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!result.isConfirmed) return;

    try {
      // 2. Ghi log trước khi xóa
      let logMsg = "";
      const reasonText = item.reward_reason || item.penalty_reason || 'Không có';

      // Logic cho Delete
      const rAmount = item.reward_amount || 0;
      const pAmount = item.penalty_amount || 0;

      if (rAmount > 0 && pAmount === 0) {
        // Chỉ có thưởng
        logMsg = `Em yêu đã xóa ${rAmount} phiếu thưởng, Lí do: ${reasonText}`;
      } else if (pAmount > 0 && rAmount === 0) {
        // Chỉ có phạt
        logMsg = `Em yêu đã xóa ${pAmount} phiếu phạt, Lí do: ${reasonText}`;
      } else {
        // Hỗn hợp cả hai
        logMsg = `Em yêu đã xóa ${rAmount} phiếu thưởng : ${pAmount} phạt, Lí do: ${reasonText}`;
      }

      await logAction('DELETE', item.id, logMsg);

      // 3. Thực hiện xóa từ Database bằng item.id
      const { error } = await supabase
        .from('rewards_penalties')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      // 4. Cập nhật giao diện
      await fetchData();
      Swal.fire({
        title: 'Đã xóa! ✨',
        text: 'Đã xóa bỏ "dấu vết" này khỏi sổ đầu bài.',
        icon: 'success',
        confirmButtonColor: '#ff85c0'
      });
    } catch (error) {
      Swal.fire({
        title: 'Lỗi xóa sổ! 🥺',
        text: `Có chút trục trặc: ${error.message}`,
        icon: 'error'
      });
    }
  };


  // --- ĐẶT NÓ Ở ĐÂY (NGANG HÀNG VỚI CÁC HÀM KHÁC) ---
  const handleEditReward = async (item) => {
    const isReward = (item.reward_amount || 0) > 0;
    const currentAmount = Math.abs((item.reward_amount || 0) + (item.penalty_amount || 0));
    const currentReason = item.reward_reason || item.penalty_reason || '';

    const { value: formValues } = await Swal.fire({
      title: '<h2 style="color: #db2777; margin: 0;">Sửa điểm `nha! ✨</h2>',
      html: `
      <div style="text-align: left; padding: 10px;">
        <div id="swal-type-container" style="display: flex; gap: 10px; margin-bottom: 20px;">
          <div id="btn-reward" style="flex:1; padding: 12px; text-align: center; border-radius: 12px; font-weight: bold; cursor: pointer; border: 2px solid #16a34a; transition: 0.3s;">🎁 Thưởng</div>
          <div id="btn-penalty" style="flex:1; padding: 12px; text-align: center; border-radius: 12px; font-weight: bold; cursor: pointer; border: 2px solid #dc2626; transition: 0.3s;">💀 Phạt</div>
        </div>
        
        <label style="font-weight: 600; color: #4b5563;">💰 Số điểm</label>
        <input id="swal-edit-amount" type="number" value="${currentAmount}" 
          style="width: 100%; padding: 12px; margin: 8px 0 20px 0; border: 2px solid #fbcfe8; border-radius: 10px; font-size: 16px; box-sizing: border-box;">
        
        <label style="font-weight: 600; color: #4b5563;">📝 Lí do</label>
        <input id="swal-edit-reason" value="${currentReason}" 
          style="width: 100%; padding: 12px; margin: 8px 0; border: 2px solid #fbcfe8; border-radius: 10px; font-size: 16px; box-sizing: border-box;">
      </div>
    `,
      confirmButtonText: 'Lưu thay đổi ✨',
      confirmButtonColor: '#db2777',
      background: '#fff0f6',
      customClass: { popup: 'rounded-xl' },
      showCancelButton: true,
      didOpen: () => {
        let selectedType = isReward ? 'reward' : 'penalty';
        const btnReward = document.getElementById('btn-reward');
        const btnPenalty = document.getElementById('btn-penalty');

        const updateUI = () => {
          btnReward.style.backgroundColor = selectedType === 'reward' ? '#16a34a' : 'transparent';
          btnReward.style.color = selectedType === 'reward' ? '#fff' : '#16a34a';
          btnPenalty.style.backgroundColor = selectedType === 'penalty' ? '#dc2626' : 'transparent';
          btnPenalty.style.color = selectedType === 'penalty' ? '#fff' : '#dc2626';
        };

        btnReward.onclick = () => { selectedType = 'reward'; updateUI(); };
        btnPenalty.onclick = () => { selectedType = 'penalty'; updateUI(); };
        updateUI();
      },
      preConfirm: () => {
        const type = document.getElementById('btn-reward').style.backgroundColor === 'rgb(22, 163, 74)' ? 'reward' : 'penalty';
        return {
          amount: Number(document.getElementById('swal-edit-amount').value),
          reason: document.getElementById('swal-edit-reason').value,
          type: type
        };
      }
    });

    if (formValues) {
      const updateData = {
        reward_amount: formValues.type === 'reward' ? Math.abs(formValues.amount) : 0,
        penalty_amount: formValues.type === 'penalty' ? Math.abs(formValues.amount) : 0,
        reward_reason: formValues.type === 'reward' ? formValues.reason : null,
        penalty_reason: formValues.type === 'penalty' ? formValues.reason : null,
      };

      const { error } = await supabase.from('rewards_penalties').update(updateData).eq('id', item.id);
      if (!error) {
        // --- 1. Xác định dữ liệu CŨ để làm mốc so sánh ---
        const oldAmount = (item.reward_amount || 0) + (item.penalty_amount || 0);
        const oldType = (item.reward_amount || 0) > 0 ? 'thưởng' : 'phạt';

        // --- 2. Xác định dữ liệu MỚI ---
        const newAmount = formValues.amount;
        const newType = formValues.type === 'reward' ? 'thưởng' : 'phạt';

        // --- 3. Tạo câu thông báo thông minh ---
        const logMessage = `Sửa từ ${oldAmount} điểm ${oldType} --> ${newAmount} điểm ${newType}. Lí do: ${formValues.reason}`;

        // --- 4. Ghi log ---
        await logAction('UPDATE', item.id, logMessage);

        await fetchData();
        Swal.fire({
          title: 'Đã sửa xong! 🪄',
          text: logMessage, // Hiển thị luôn cho ní xem trong thông báo
          icon: 'success',
          background: '#fff0f6',
          confirmButtonColor: '#db2777'
        });
      }
    }
  };

  // --- GỬI THÔNG BÁO TỔNG KẾT TELEGRAM ---
  const handleSummaryAndNotify = async () => {
    const ngayChon = inputDate;
    const hienThiNgay = new Date(ngayChon).toLocaleDateString('vi-VN');

    let tongPhatHomNay = 0;
    let tongThuongHomNay = 0;
    let tongDoiQuaHomNay = 0;

    const rpToday = rewardsPenalties.filter(item => item.date === ngayChon);

    rpToday.forEach(item => {
      const phat = Number(item.penalty_amount || 0);
      const thuong = Number(item.reward_amount || 0);
      tongPhatHomNay += phat;
      if (thuong > 0) { tongThuongHomNay += thuong; }
      else if (thuong < 0) { tongDoiQuaHomNay += Math.abs(thuong); }
    });

    const displayDoiQua = tongDoiQuaHomNay > 0 ? `-${tongDoiQuaHomNay}` : "0";

    // 1. Thông báo gửi cho Anh yêu (vẫn giữ vẻ "quyền lực" và răn đe)
    const thongBaoChoAnh =
      `🎀 ✨ *SỔ ĐẦU BÀI HÔM NAY* ✨ 🎀\n` +
      `📅 Ngày chốt: *${hienThiNgay}*\n` +
      `─────────────────────────\n` +
      `🎁 Thưởng: *+${tongThuongHomNay}*\n` +
      `💀 Phạt: *-${tongPhatHomNay}*\n` +
      `🛒 Đã đổi: *${displayDoiQua}*\n` +
      `─────────────────────────\n` +
      `🎯 *Quỹ tích lũy:* ${totalRewards} phiếu\n\n` +
      `${totalRewards >= 0
        ? "🧸 Anh yêu vẫn còn dư dả nè! 🥰"
        : "💔 Anh yêu nợ " + Math.abs(totalRewards) + " phiếu phạt! Đến giờ ăn đòn!!! 👿"}`;

    // 2. Thông báo gửi cho Công chúa (ngọt ngào, báo cáo để Công chúa nắm tình hình)
    const thongBaoChoEm =
      `💖 ✨ *BÁO CÁO CỦA CÔNG CHÚA* ✨ 💖\n` +
      `📅 Ngày chốt: *${hienThiNgay}*\n` +
      `─────────────────────────\n` +
      `🎁 Thưởng: *+${tongThuongHomNay}*\n` +
      `💀 Phạt: *-${tongPhatHomNay}*\n` +
      `🛒 Đã đổi: *${displayDoiQua}*\n` +
      `─────────────────────────\n` +
      `🎯 *Quỹ hiện tại:* ${totalRewards} phiếu\n\n` +
      `${totalRewards >= 0
        ? "🥰 Quỹ vẫn đang ổn áp, Công chúa yên tâm nha!"
        : "👑 Anh yêu đang nợ Công chúa " + Math.abs(totalRewards) + " phiếu phạt. Nhớ nhắc ảnh ăn đòn nhé! 😉"}`;

    try {
      // Bắn cho Anh người yêu (Sử dụng đúng tên biến thongBaoChoAnh)
      if (idTeleCuaAnh) {
        await callTelegramAPI(idTeleCuaAnh, thongBaoChoAnh);
      }

      // Bắn tiếp cho Công chúa (Sử dụng đúng tên biến thongBaoChoEm)
      if (idTeleCuaEm) {
        await callTelegramAPI(idTeleCuaEm, thongBaoChoEm);
      }

      Swal.fire({
        title: 'Báo cáo đã "bay" đến nơi rồi! 💌✨',
        html: `
          <div style="text-align: center;">
            <p>Tin nhắn đã được gửi đến Telegram cho cả Anh yêu và Công chúa rồi nha! 🚀</p>
            <p>Đợi xem anh ấy có "run rẩy" khi đọc báo cáo không nào... 🥰</p>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6',
        confirmButtonText: 'Đã rõ, hóng kết quả! 👑'
      });
    } catch (err) {
      console.error(err); // Thêm dòng này để ní mở F12 xem chi tiết lỗi nếu vẫn bị
      Swal.fire({
        title: 'Ôi hỏng rồi! 🥺',
        text: 'Có chút trục trặc khi bắn tin, Công chúa thử lại lần nữa nhé!',
        icon: 'error',
        confirmButtonColor: '#ff85c0',
        background: '#fff0f6'
      });
    }
  };

  return (
    <Routes>
      <Route path="/" element={
        !isLoggedIn ? (
          <LoginView
            handleLogin={handleLogin}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            loginError={loginError}
          />
        ) : (
          role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/user" />
        )
      } />

      <Route path="/admin" element={
        isLoggedIn && role === 'admin' ? (
          <AdminView
            handleLogout={handleLogout}
            handleSendQuiz={handleSendQuiz}
            kahootLink={kahootLink}
            setKahootLink={setKahootLink}
            loadingAdmin={loadingAdmin}
            messageAdmin={messageAdmin}
            handleSummaryAndNotify={handleSummaryAndNotify}
            handleAddTicket={handleAddTicket}
            inputDate={inputDate}
            setInputDate={setInputDate}
            rewardAmount={rewardAmount}
            setRewardAmount={setRewardAmount}
            penaltyAmount={penaltyAmount}
            setPenaltyAmount={setPenaltyAmount}
            reason={reason}
            setReason={setReason}
            loadingTicket={loadingTicket}
            rewardsPenalties={rewardsPenalties}
            handleDeleteTicket={handleDeleteTicket}
            quizzes={quizzes}
            handleDeleteQuiz={handleDeleteQuiz}
            handleEditQuiz={handleEditQuiz}
            handleEditReward={handleEditReward}
            chartData={chartData}
            loadingInitial={loadingInitial}
            showAuditLog={showAuditLog}
            setShowAuditLog={setShowAuditLog} // NI THIẾU DÒNG NÀY Ở ĐÂY NÈ!
            auditLogs={auditLogs}
            fetchLogs={fetchLogs}
            newSpinCost={newSpinCost}
            setNewSpinCost={setNewSpinCost}
            prizes={prizes}
            setPrizes={setPrizes}
            updateWheelSettings={updateWheelSettings}
            addPrize={addPrize}
            removePrize={removePrize}
            updatePrize={updatePrize}
          />
        ) : <Navigate to="/" />
      } />

      <Route path="/user" element={
        isLoggedIn && role === 'user' ? (
          <UserView
            handleLogout={handleLogout}
            honthuong={honthuong}
            soHunMoi={soHunMoi}
            soHunSau={soHunSau}
            handleExchangeGift={handleExchangeGift}
            loadingExchange={loadingExchange}
            totalRewards={totalRewards}
            quizzes={quizzes}
            scores={scores}
            setScores={setScores}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            handleSubmitScore={handleSubmitScore}
            loadingUser={loadingUser}
            rewardsPenalties={rewardsPenalties}
            loadingInitial={loadingInitial}
            chartData={chartData}
            handleLuckyWheelWin={handleLuckyWheelWin}
            prizes={prizes}
            setPrizes={setPrizes}
          />
        ) : <Navigate to="/" />
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

// =========================================================================
// CÁC COMPONENT TĨNH ĐỘC LẬP CHỐNG MẤT FOCUS KHI GÕ CHỮ

const LoginView = ({ handleLogin, username, setUsername, password, setPassword, loginError }) => (
  <div style={styles.containerLogin}>
    <div style={styles.cardLogin}>
      <h2 style={{ color: '#ff4d94', marginBottom: '20px' }}>🎮 Love Game Login 💖</h2>
      <form onSubmit={handleLogin} style={styles.form}>
        <label style={styles.label}>Tên đăng nhập:</label>
        <input type="text" placeholder="Gõ tài khoản..." value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} required />
        <label style={styles.label}>Mật khẩu:</label>
        <input type="password" placeholder="Gõ mật khẩu..." value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
        <button type="submit" style={styles.buttonLogin}>Đăng Nhập</button>
      </form>
      {loginError && <p style={{ color: 'red', marginTop: '15px', fontSize: '14px', fontWeight: '500' }}>{loginError}</p>}
    </div>
  </div>
);

const AdminView = ({
  handleLogout, handleSendQuiz, kahootLink, setKahootLink, loadingAdmin, messageAdmin,
  handleSummaryAndNotify, handleAddTicket, inputDate, setInputDate, rewardAmount, setRewardAmount,
  penaltyAmount, setPenaltyAmount, reason, setReason, loadingTicket, rewardsPenalties, handleDeleteTicket, quizzes, handleDeleteQuiz, handleEditQuiz, handleEditReward, chartData,
  fetchLogs, showAuditLog, auditLogs, setShowAuditLog, loadingInitial, newSpinCost, setNewSpinCost, newPrizes, setNewPrizes, updateWheelSettings, prizes, setPrizes, addPrize, removePrize, updatePrize
}) => {
  if (loadingInitial) return <CuteLoading />;

  return (
    <div style={styles.containerAdmin}>
      <button onClick={handleLogout} style={styles.btnLogout}>🚪 Đăng xuất</button>
      <div style={styles.mainWrapper}>

        {/* 1. TRẠM PHÁT THỬ THÁCH */}
        <div style={styles.card}>
          <h1 style={styles.title}>💖 Trạm Phát Thử Thách 💖</h1>
          <p style={styles.subtitle}>Dành riêng cho Công Chúa của anh (Admin)</p>
          <form onSubmit={handleSendQuiz} style={styles.form}>
            <label style={styles.label}>Dán Link Kahoot vào đây nè em yêu:</label>
            <input type="text" placeholder="https://kahoot.it/..." value={kahootLink} onChange={(e) => setKahootLink(e.target.value)} style={styles.inputAdmin} disabled={loadingAdmin} />
            <ButtonCute
              type="submit"
              style={styles.buttonAdmin}
              loading={loadingAdmin}
            >
              🚀 Bắn Thử Thách Cho Người Yêu
            </ButtonCute>
          </form>
          {messageAdmin && <p style={styles.message}>{messageAdmin}</p>}
        </div>

        {/* 2. ĐẶT KHU VỰC VÒNG QUAY Ở ĐÂY NÈ! */}
        <div style={{
          marginTop: '30px', padding: '25px', border: 'none',
          borderRadius: '20px', backgroundColor: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)', fontFamily: 'Arial, sans-serif'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>⚙️ Cài đặt Vòng quay</h3>

          {/* 1. Nhập chi phí */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#4b5563', marginBottom: '8px', display: 'block' }}>
              Chi phí lượt quay (Số phiếu):
            </label>
            <input
              type="number"
              value={newSpinCost}
              onChange={(e) => setNewSpinCost(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
            />
          </div>

          {/* 2. Danh sách phần thưởng (Sửa từ textarea thành list) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#4b5563', marginBottom: '8px', display: 'block' }}>
              Danh sách phần thưởng:
            </label>

            {prizes.map((p, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  value={p.text}
                  onChange={(e) => updatePrize(index, e.target.value)}
                  placeholder={`Nhập tên quà ${index + 1}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <button
                  onClick={() => removePrize(index)}
                  style={{ padding: '5px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Xóa
                </button>
              </div>
            ))}

            <button
              onClick={addPrize}
              style={{ width: '100%', padding: '10px', marginTop: '5px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + Thêm phần thưởng
            </button>
          </div>

          {/* 3. Nút cập nhật */}
          <button
            onClick={updateWheelSettings}
            style={{
              width: '100%', padding: '14px', backgroundColor: '#f43f5e', color: 'white',
              border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px',
              cursor: 'pointer', transition: 'background 0.3s'
            }}
          >
            Cập nhật vòng quay ngay ✨
          </button>
        </div>


        {/* 2. BẢNG QUẢN LÝ THỬ THÁCH (MỚI) */}
        <div style={styles.cardLarge}>
          <h2 style={{ color: '#db2777', margin: '0 0 10px 0' }}>📜 Danh sách thử thách đã đăng</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ backgroundColor: '#fff1f2' }}>
                  <th style={styles.th}>Ngày</th>
                  <th style={styles.th}>Link</th>
                  <th style={styles.th}>Trạng thái</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>

                {(quizzes || []).map((quiz) => (
                  <tr key={quiz.id} style={styles.tr}>
                    <td style={styles.td}>
                      {new Date(quiz.created_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td style={styles.td}>
                      <a href={quiz.link_kahoot} style={styles.quizLink}>Xem bài</a>
                    </td>
                    <td style={styles.td}>{quiz.status === 'COMPLETED' ? '✅' : '⏳'}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button onClick={() => handleEditQuiz(quiz)} style={{ ...styles.btnDelete, backgroundColor: '#eab308', marginRight: '5px' }}>Sửa</button>
                      <button onClick={() => handleDeleteQuiz(quiz.id)} style={styles.btnDelete}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={styles.cardLarge}>
          <h2 style={{ color: '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px 0' }}>
            📋 Sổ Đầu Bài Thưởng Phạt <button onClick={handleSummaryAndNotify} style={styles.btnNotify}>📢 Bắn Tổng Kết Lên Tele</button>
          </h2>

          {/* --- NÍ DÁN VÀO ĐÂY NÈ --- */}
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <button
              onClick={() => {
                if (!showAuditLog) fetchLogs(); // Chỉ gọi lấy dữ liệu khi người dùng chuẩn bị mở
                setShowAuditLog(!showAuditLog); // Toggle ẩn/hiện bảng
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {showAuditLog ? 'Ẩn Lịch Sử Log' : '🔍 Xem Lịch Sử Thêm Điểm'}
            </button>
          </div>

          {/* PHẦN HIỂN THỊ LOG (HIỆN RA KHI BẤM) */}
          {showAuditLog && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>

              {/* --- THÊM: Kiểm tra nếu danh sách trống thì hiện thông báo --- */}
              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontStyle: 'italic' }}>
                  ✨ Sổ trắng tinh khôi! Chưa có ghi chép nào đâu nè Công Chúa ơi~ 👑
                </div>
              ) : (
                /* --- Danh sách log --- */
                auditLogs.map((log) => (
                  <div key={log.id} style={{
                    padding: '16px',
                    backgroundColor: '#fff',
                    // Thêm dấu ?. để tránh lỗi khi dữ liệu bị null
                    borderLeft: `6px solid ${log.action_type === 'DELETE' ? '#f43f5e' : (log.action_type === 'INSERT' ? '#10b981' : '#3b82f6')}`,
                    borderRadius: '10px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ flex: 1 }}>
                      {/* Nếu log bị trống thì hiện chữ mặc định */}
                      <div style={{ fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                        {log.action_details || "Hành động không xác định"}
                      </div>

                      <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '15px' }}>
                        <span>📅 {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}</span>
                        <span>⏰ {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#374151',
                      marginLeft: '10px'
                    }}>
                      {log.action_type || "N/A"}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{
            margin: '20px auto',
            maxWidth: '500px',
            padding: '10px',
            backgroundColor: '#fdf2f8',
            borderRadius: '15px'
          }}>
            <ChartSummary data={chartData} />
          </div>


          <div style={{
            textAlign: 'center',
            margin: '25px auto',
            padding: '15px',
            backgroundColor: '#fff',       // Nền trắng tinh khôi
            borderRadius: '20px',          // Bo góc tròn trịa
            boxShadow: '0 8px 16px rgba(219, 39, 119, 0.15)', // Đổ bóng nhẹ màu hồng
            border: '1px solid #fbcfe8',   // Viền hồng thật mỏng thôi
            maxWidth: '90%'                // Cho nó gọn gàng
          }}>
            <p style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '700',
              color: '#db2777',
              letterSpacing: '0.5px'       // Giãn chữ một tí cho thoáng
            }}>
              ✨ Ghi Chép Sổ Tay Khen Thưởng & "Phạt Yêu" ✨
            </p>
          </div>

          <form onSubmit={handleAddTicket} style={styles.newTicketCard}>
            <div style={styles.newFormGrid}>
              <div style={styles.inputWrapper}>
                <label style={styles.newLabel}>📅 Chọn Ngày</label>
                <input type="date" value={inputDate} onChange={(e) => setInputDate(e.target.value)} style={styles.newInput} required />
              </div>
              <div style={styles.inputWrapper}>
                <label style={styles.newLabel}>🎁 Số Phiếu Thưởng</label>
                <input type="number" min="0" value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} style={{ ...styles.newInput, borderLeft: '4px solid #4CAF50' }} />
              </div>
              <div style={styles.inputWrapper}>
                <label style={styles.newLabel}>💀 Số Phiếu Phạt</label>
                <input type="number" min="0" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} style={{ ...styles.newInput, borderLeft: '4px solid #F44336' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '5px' }}>
              <label style={styles.newLabel}>📝 Lí do thưởng / phạt:</label>
              <input
                type="text"
                placeholder="Nhập lí do cụ thể vào đây nhen em yêu... 💕"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={styles.newInput}
                disabled={loadingTicket}
              />
            </div>

            <ButtonCute
              type="submit"
              style={styles.newBtnSubmit}
              loading={loadingTicket}
            >
              🚀 Ghi Vào Sổ Đầu Bài
            </ButtonCute>
          </form>

          <div style={{ marginTop: '25px', overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={styles.th}>Ngày chốt điểm</th>
                  <th style={styles.th}>🎁 Điểm Thưởng tích lũy</th>
                  <th style={styles.th}>💀 Điểm Phạt nhận về</th>
                  <th style={styles.th}>📝 Lí Do</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {rewardsPenalties.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Sổ trống trơn! ✨</td></tr>
                ) : (
                  rewardsPenalties.map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>
                        {new Date(item.created_at).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td style={{ ...styles.td, fontWeight: '700', color: item.reward_amount < 0 ? '#b45309' : '#16a34a', fontSize: '15px' }}>
                        {item.reward_amount > 0 ? `+${item.reward_amount} Phiếu` : item.reward_amount < 0 ? `${item.reward_amount}` : '0'}
                      </td>
                      <td style={{ ...styles.td, fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
                        {item.penalty_amount > 0 ? `-${item.penalty_amount} Phiếu` : '0'}
                      </td>
                      {/* Hiển thị thông minh linh hoạt: Ưu tiên hiển thị lý do thưởng trước, nếu không có thì lấy lý do phạt */}
                      <td style={{ ...styles.td, color: '#475569', fontWeight: '500', fontStyle: (item.reward_reason || item.penalty_reason) ? 'normal' : 'italic' }}>
                        {item.reward_reason || item.penalty_reason || 'Không có lí do'}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // KIỂM TRA: Xem trong console nó báo item là gì
                              console.log("Ní đang bấm vào dòng có dữ liệu là:", item);

                              if (item) {
                                handleEditReward(item);
                              } else {
                                console.error("Lỗi: Không tìm thấy dữ liệu item cho dòng này!");
                              }
                            }}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              position: 'relative', // Thêm cái này
                              zIndex: 10            // Và cái này
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(item)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            Xóa sổ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserView = ({
  handleLogout, soHunMoi, soHunSau, handleExchangeGift, loadingExchange,
  totalRewards, quizzes, scores, setScores, selectedFiles, setSelectedFiles, handleSubmitScore,
  loadingUser, rewardsPenalties, chartData, honthuong, loadingInitial, handleLuckyWheelWin
}) => {
  if (loadingInitial) return <CuteLoading />;

  return (
    <div style={styles.containerUser}>
      <button onClick={handleLogout} style={styles.btnLogout}>🚪 Đăng xuất</button>

      <div style={styles.mainWrapper}>

        {/* ==================== CỘT PHẢI HOẶC KHU VỰC TIÊU PHIẾU ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '1 1 350px' }}>

          {/* 1. Ví Quy Đổi Quà Cố Định */}
          <div style={styles.exchangeCard}>
            <h2 style={{ color: '#db2777', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>🏪 VÍ QUY ĐỔI PHẦN THƯỞNG 🏪</h2>
            <p style={{ color: '#667085', fontSize: '13px', margin: '0 0 15px 0' }}>Quy tắc đổi quà: 10 Phiếu = 1 Hun môi 💋 | 5 Hun môi = 1 Hun sâu 🔥</p>

            <div style={styles.exchangeGrid}>
              <div style={styles.exchangeItem}>
                <span style={{ fontSize: '24px' }}>🎁</span>
                <span style={styles.exchangeValue}>{honthuong}</span>
                <span style={styles.exchangeLabel}>Nụ hôn thường đang có</span>
              </div>
              <div style={{ ...styles.exchangeItem, borderLeft: '1px solid #fbcfe8', borderRight: '1px solid #fbcfe8' }}>
                <span style={{ fontSize: '24px' }}>💋</span>
                <span style={{ ...styles.exchangeValue, color: '#e91e63' }}>{soHunMoi}</span>
                <span style={styles.exchangeLabel}>Hun Môi Đang Có</span>
              </div>
              <div style={styles.exchangeItem}>
                <span style={{ fontSize: '24px' }}>🔥</span>
                <span style={{ ...styles.exchangeValue, color: '#9333ea' }}>{soHunSau}</span>
                <span style={styles.exchangeLabel}>Hun Sâu Đang Có</span>
              </div>
            </div>

            <div style={styles.exchangeActions}>
              <ButtonCute
                onClick={() => handleExchangeGift('HUN_MOI')}
                style={{ ...styles.btnExchange, backgroundColor: '#e91e63' }}
                loading={loadingExchange}
              >
                💋 Đổi 10 Phiếu = 1 Hun Môi
              </ButtonCute>

              <ButtonCute
                onClick={() => handleExchangeGift('HUN_SAU')}
                style={{ ...styles.btnExchange, backgroundColor: '#7c3aed' }}
                loading={loadingExchange}
              >
                🔥 Đổi 50 Phiếu = 1 Hun Sâu
              </ButtonCute>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#98a2b3', fontWeight: '600' }}>
              🎯 Tổng số phiếu thưởng khả dụng thực tế: {totalRewards} phiếu
            </div>
          </div>

          {/* 2. Vòng Quay May Mắn */}
          <div style={{ ...styles.card, padding: '20px', display: 'flex', justifyContent: 'center' }}>
            <LuckyWheel
              totalRewards={totalRewards}
              onWin={handleLuckyWheelWin} // Truyền trúng cổng tiếp nhận kết quả
              loading={loadingExchange}
            />
          </div>

        </div>

        {/* ==================== CỘT TRÁI HOẶC KHU VỰC NHIỆM VỤ & THỐNG KÊ ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '2 1 600px' }}>

          {/* 3. Phòng làm bài Kahoot */}
          <div style={styles.cardLarge}>
            <h1 style={styles.titleUser}>🎮 Phòng Làm Bài Của Anh Người Yêu 🎮</h1>
            <p style={styles.subtitle}>Nhiệm vụ tối mật - Không làm ăn phạt</p>
            <div style={styles.quizList}>
              {quizzes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>🎉 Chưa có thử thách nào hết ní ơi!</p>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} style={quiz.status === 'COMPLETED' ? styles.quizItemDone : styles.quizItemPending}>
                    <div style={styles.quizInfo}>
                      <p style={styles.quizDate}>📅 Ngày giao: {new Date(quiz.created_at).toLocaleDateString('vi-VN')}</p>
                      <a href={quiz.link_kahoot} target="_blank" rel="noreferrer" style={styles.quizLink}>🔗 Link làm bài Kahoot</a>
                    </div>
                    <div style={styles.quizAction}>
                      {quiz.status === 'COMPLETED' ? (
                        <div style={styles.badgeDone}>🎯 Đã xong: {quiz.score} điểm</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="number" placeholder="Điểm..." onChange={(e) => setScores({ ...scores, [quiz.id]: e.target.value })} style={styles.inputScore} />
                            <ButtonCute
                              onClick={() => handleSubmitScore(quiz.id)}
                              style={styles.btnSubmit}
                              loading={loadingUser}
                            >
                              Nộp Điểm
                            </ButtonCute>
                          </div>
                          <input type="file" accept="image/*" onChange={(e) => setSelectedFiles({ ...selectedFiles, [quiz.id]: e.target.files[0] })} style={{ fontSize: '12px', width: '170px' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Thống Kê Biểu Đồ & Sổ Đầu Bài */}
          <div style={styles.cardLarge}>
            <div style={{
              margin: '20px auto',
              maxWidth: '500px',
              padding: '10px',
              backgroundColor: '#fdf2f8',
              borderRadius: '15px'
            }}>
              <ChartSummary data={chartData} />
            </div>
            <h2 style={{ color: '#1e3a8a', margin: '0 0 10px 0' }}>📋 Sổ Đầu Bài Thưởng Phạt</h2>
            <p style={styles.subtitle}>Ghi chép công đức và tội lỗi nội bộ</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={styles.th}>Ngày chốt điểm</th>
                    <th style={styles.th}>🎁 Điểm Thưởng tích lũy</th>
                    <th style={styles.th}>💀 Điểm Phạt nhận về</th>
                    <th style={styles.th}>📝 Lí Do</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardsPenalties.map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                      <td style={{ ...styles.td, fontWeight: '700', color: item.reward_amount < 0 ? '#b45309' : '#16a34a', fontSize: '15px' }}>
                        {item.reward_amount > 0 ? `+${item.reward_amount} Phiếu` : item.reward_amount < 0 ? `${item.reward_amount}` : '0'}
                      </td>
                      <td style={{ ...styles.td, fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>{item.penalty_amount > 0 ? `-${item.penalty_amount} Phiếu` : '0'}</td>
                      <td style={{ ...styles.td, color: '#64748b', fontStyle: (item.reward_reason || item.penalty_reason) ? 'normal' : 'italic' }}>
                        {item.reward_reason || item.penalty_reason || 'Không có lí do'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div> {/* Hết mainWrapper */}
    </div>
  );
};

// BẢNG MÃ CSS INLINE GIAO DIỆN
const styles = {
  containerLogin: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'Segoe UI, sans-serif' },
  cardLogin: { backgroundColor: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '380px', textAlign: 'center' },
  containerAdmin: { display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#ffeaf2', fontFamily: 'Segoe UI, sans-serif', padding: '40px 20px', position: 'relative' },
  containerUser: { display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#eff6ff', fontFamily: 'Segoe UI, sans-serif', padding: '40px 20px', position: 'relative' },
  mainWrapper: { display: 'flex', flexDirection: 'column', gap: '30px', width: '100%', maxWidth: '750px', marginTop: '20px' },
  card: { backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center' },
  cardLarge: { backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' },
  form: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  exchangeCard: { backgroundColor: '#fff1f2', padding: '20px', borderRadius: '20px', border: '1px solid #fecdd3', boxShadow: '0 8px 20px rgba(225, 29, 72, 0.05)' },
  exchangeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px 0', border: '1px solid #ffe4e6' },
  exchangeItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  exchangeValue: { fontSize: '22px', fontWeight: '800', color: '#334155' },
  exchangeLabel: { fontSize: '11px', fontWeight: '600', color: '#64748b', textAlign: 'center' },
  exchangeActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '15px' },
  btnExchange: { padding: '10px 15px', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', opacity: 1 },
  newTicketCard: { display: 'flex', flexDirection: 'column', gap: '15px', padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #ffe3ec', boxShadow: '0 4px 15px rgba(233, 30, 99, 0.05)', marginTop: '15px' },
  newFormGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' },
  inputWrapper: { display: 'flex', flexDirection: 'column', gap: '4px' },
  newLabel: { fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
  newInput: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600', color: '#334155', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' },
  newBtnSubmit: { width: '100%', padding: '14px', backgroundColor: '#e91e63', color: '#ffffff', border: 'none', borderRadius: '30px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(233, 30, 99, 0.2)', marginTop: '5px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  inputAdmin: { padding: '12px 15px', borderRadius: '10px', border: '2px solid #ffccd5', fontSize: '16px', marginBottom: '20px', outline: 'none' },
  buttonLogin: { padding: '12px', backgroundColor: '#ff4d94', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  buttonAdmin: { padding: '12px', backgroundColor: '#ff4d94', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  btnNotify: { padding: '6px 12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
  btnDelete: { padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' },
  btnLogout: { position: 'absolute', top: '20px', right: '20px', padding: '8px 15px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 },
  message: { marginTop: '20px', padding: '10px', backgroundColor: '#fff0f6', borderRadius: '8px', color: '#c41d7f', fontSize: '14px', fontWeight: '500', textAlign: 'center', border: '1px solid #ffd6e7' },
  quizList: { display: 'flex', flexDirection: 'column', gap: '15px' },
  quizItemPending: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '12px', border: '2px solid #3b82f6', backgroundColor: '#ffffff' },
  quizItemDone: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', opacity: 0.8 },
  quizInfo: { display: 'flex', flexDirection: 'column', gap: '5px' },
  quizDate: { margin: 0, fontSize: '12px', color: '#666' },
  quizLink: { color: '#2563eb', fontWeight: '600', textDecoration: 'none', fontSize: '14px' },
  inputScore: { width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #bcd1f8', textAlign: 'center' },
  btnSubmit: { padding: '8px 15px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  badgeDone: { padding: '6px 12px', backgroundColor: '#10b981', color: 'white', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  th: { padding: '12px 10px', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 'bold' },
  td: { padding: '12px 10px', borderBottom: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' },
  tr: {},
  title: { color: '#ff4d94', margin: '0 0 10px 0' },
  titleUser: { color: '#2563eb', margin: '0 0 10px 0' },
  subtitle: { color: '#666', fontSize: '14px', margin: '0 0 20px 0' }
};

export default App;
