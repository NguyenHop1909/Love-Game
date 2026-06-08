import React from 'react';
import './Loading.css'; // Đảm bảo đã import CSS

const ButtonCute = ({ loading, children, className, style, ...props }) => {
    return (
        <button
            className={`${className || ''} ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
            style={{
                ...style,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
            }}
            {...props}
        >
            {children}
        </button>
    );
};

export default ButtonCute;