import React from 'react';
import './Loading.css'; // Nhớ import file CSS ở trên nha ní

const CuteLoading = () => {
    return (
        <div className="cute-loading-container">
            <div className="cute-heart">💖</div>
            <div className="cute-loading-text">
                <span>Đ</span>
                <span>ợ</span>
                <span>i</span>
                <span>&nbsp;</span>
                <span>A</span>
                <span>n</span>
                <span>h</span>
                <span>&nbsp;</span>
                <span>X</span>
                <span>í</span>
                <span>u</span>
                <span>.</span>
                <span>.</span>
                <span>.</span>
            </div>
        </div>
    );
};

export default CuteLoading;