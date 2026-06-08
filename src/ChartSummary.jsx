import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, BarChart } from 'recharts';

const ChartSummary = ({ data }) => {
  // NẾU KHÔNG CÓ DỮ LIỆU THÌ KHÔNG VẼ, TRÁNH LỖI WIDTH(-1)
  if (!data || data.length === 0) return null;
  return (
    <div style={{
      width: '100%',
      height: '300px',
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '20px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      marginBottom: '20px'
    }}>
      <h4 style={{ textAlign: 'center', color: '#db2777', margin: '0 0 15px 0' }}>📈 Tình hình Thăng Trầm</h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="reward" stroke="#16a34a" strokeWidth={3} name="Thưởng" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="penalty" stroke="#dc2626" strokeWidth={3} name="Phạt" dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartSummary;