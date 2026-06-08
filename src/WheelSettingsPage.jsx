import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from './supabaseClient';

export default function WheelSettingsPage({ currentPrizes, currentCost }) {
    const [prizes, setPrizes] = useState(currentPrizes.map(p => p.text).join('\n'));
    const [cost, setCost] = useState(currentCost);

    const handleSave = async () => {
        const lines = prizes.split('\n').filter(l => l.trim() !== "");
        const colors = ['#ff9aa2', '#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'];
        const formatted = lines.map((text, i) => ({ text, color: colors[i % colors.length] }));

        const { error } = await supabase.from('wheel_settings').update({ prizes: formatted, spin_cost: cost }).eq('id', 1);
        if (error) Swal.fire('Lỗi!', error.message, 'error');
        else Swal.fire('Xong!', 'Cấu hình đã được lưu', 'success');
    };

    return (
        <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', background: '#fff', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <h2 style={{ borderBottom: '2px solid #f43f5e', paddingBottom: '10px' }}>⚙️ Cấu hình Vòng quay</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <label>Chi phí mỗi lượt (Số phiếu):</label>
                <input type="number" value={cost} onChange={e => setCost(e.target.value)} style={{ padding: '10px' }} />

                <label>Danh sách phần thưởng (Mỗi dòng 1 giải):</label>
                <textarea rows="10" value={prizes} onChange={e => setPrizes(e.target.value)} style={{ padding: '10px', width: '100%' }} />

                <button onClick={handleSave} style={{ padding: '15px', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    Lưu cấu hình
                </button>
            </div>
        </div>
    );
}