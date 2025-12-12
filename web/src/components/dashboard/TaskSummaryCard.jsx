// src/components/dashboard/TaskSummaryCard.jsx
import React from "react";
import { Card, Button, Statistic, Divider, Row, Col, Tag, message } from "antd";
import {
  AreaChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ProjectOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#FF4D4F"];

export default function TaskSummaryCard({ veri }) {
  const pastaVerisi = veri.gorevDurumlari.map((d) => ({
    name: d.durum,
    value: parseInt(d.count),
  }));

  return (
    <Card
      title="Görev Özeti"
      style={{ borderRadius: 12, height: "100%" }}
      extra={
        <Button
          type="text"
          icon={<AreaChartOutlined />}
          onClick={() => {
            message.info("Görevler sayfası yapım aşamasında");
            // veya:
            // window.location.href = "/gorevler";
          }}
          size="small"
        >
          Tümünü Gör
        </Button>
      }
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pastaVerisi}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
              label={(entry) => `${entry.name}: ${entry.value}`}
            >
              {pastaVerisi.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value, name) => [`${value} görev`, name]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      {/* HIZLI İSTATİSTİKLER */}
      <Row gutter={[8, 8]}>
        <Col span={12}>
          <Card size="small" style={{ background: "#f6ffed", border: "none" }}>
            <Statistic
              title="Tamamlanan"
              value={veri.bitenIsler}
              valueStyle={{ color: "#52c41a", fontSize: 18 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ background: "#fff7e6", border: "none" }}>
            <Statistic
              title="Devam Eden"
              value={veri.toplamGorev - veri.bitenIsler}
              valueStyle={{ color: "#faad14", fontSize: 18 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ background: "#e6f7ff", border: "none" }}>
            <Statistic
              title="Toplam"
              value={veri.toplamGorev}
              valueStyle={{ color: "#1890ff", fontSize: 18 }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ background: "#f9f0ff", border: "none" }}>
            <Statistic
              title="Proje"
              value={veri.toplamProje}
              valueStyle={{ color: "#722ed1", fontSize: 18 }}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </Card>
  );
}
