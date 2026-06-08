import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { supabase } from './supabaseClient';

const audioQuay = new Audio('/xosoMB.wav');

export default function LuckyWheel({ totalRewards, onWin, loading }) {
    const [rotation, setRotation] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [prizes, setPrizes] = useState([]);
    const [spinCost, setSpinCost] = useState(2);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('wheel_settings').select('*').eq('id', 1).single();
            if (data) {
                setPrizes(data.prizes || []);
                setSpinCost(data.spin_cost || 0);
            }
        };
        fetchSettings();

        const channel = supabase.channel('wheel_settings_channel')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wheel_settings', filter: 'id=eq.1' },
                (payload) => {
                    const newPrizes = typeof payload.new.prizes === 'string' ? JSON.parse(payload.new.prizes) : payload.new.prizes;
                    setPrizes(newPrizes || []);
                    setSpinCost(payload.new.spin_cost || 0);
                }).subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const handleSpin = () => {
        if (isSpinning || loading || prizes.length === 0) return;
        if (totalRewards < spinCost) {
            Swal.fire('Nghèo quá ní ơi! 💀', `Cần ${spinCost} phiếu nè!`, 'error');
            return;
        }

        setIsSpinning(true);
        audioQuay.play().catch(() => { });

        const prizeCount = prizes.length;
        const randomPrizeIndex = Math.floor(Math.random() * prizeCount);
        const degreesPerPrize = 360 / prizeCount;
        // Xoay thêm 10 vòng + góc ngẫu nhiên
        const targetAngle = 3600 + (360 - (randomPrizeIndex * degreesPerPrize) - (degreesPerPrize / 2));
        setRotation(prev => prev + targetAngle);

        setTimeout(() => {
            setIsSpinning(false);
            audioQuay.pause();
            audioQuay.currentTime = 0;
            if (onWin) onWin(prizes[randomPrizeIndex].text);
        }, 13000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', padding: '10px' }}>
            <div style={{
                position: 'relative', width: '320px', height: '320px', padding: '12px', borderRadius: '50%',
                background: 'linear-gradient(145deg, #f43f5e, #be123c)',
                boxShadow: 'inset 2px 2px 5px rgba(255,255,255,0.4), inset -2px -2px 5px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{ position: 'absolute', top: '-15px', borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '32px solid #f43f5e', zIndex: 30 }} />

                <div style={{
                    width: '100%', height: '100%', borderRadius: '50%', position: 'relative', overflow: 'hidden',
                    transition: 'transform 13s cubic-bezier(0.1, 0.8, 0.1, 1)',
                    transform: `rotate(${rotation}deg)`,
                    background: prizes.length > 0
                        ? `conic-gradient(${prizes.map((p, i) => `${p.color} ${i * (360 / prizes.length)}deg ${(i + 1) * (360 / prizes.length)}deg`).join(', ')})`
                        : '#f43f5e'
                }}>
                    {/* Vẽ nan quạt linh động */}
                    {prizes.map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute', width: '2px', height: '50%', top: 0, left: '50%',
                            backgroundColor: 'rgba(255,255,255,0.4)', transformOrigin: 'bottom center',
                            transform: `translateX(-50%) rotate(${i * (360 / prizes.length)}deg)`, zIndex: 2
                        }} />
                    ))}

                    {/* Hiển thị chữ linh động */}
                    {prizes.map((p, i) => (
                        <div key={i} style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            transform: `rotate(${i * (360 / prizes.length) + (360 / prizes.length / 2)}deg)`,
                            display: 'flex', justifyContent: 'center', zIndex: 3
                        }}>
                            <div style={{ paddingTop: '20px', width: '70px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>
                                {p.text}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25, border: '3px solid #fff' }}>
                    ❤️
                </div>
            </div>

            <button onClick={handleSpin} disabled={isSpinning || prizes.length === 0} style={{
                padding: '12px 35px', backgroundColor: isSpinning ? '#cbd5e1' : '#f43f5e', color: 'white',
                border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: isSpinning ? 'none' : '0 6px 16px rgba(244,63,94,0.4)', transition: '0.1s'
            }}>
                {isSpinning ? '🎲 Đang quay...' : `🎡 Quay Nhân Phẩm (${spinCost} phiếu)`}
            </button>
        </div>
    );
}