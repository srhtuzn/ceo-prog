// src/components/dashboard/modals/SuccessAnalysisModal.jsx
import React from "react";
import {
  Modal,
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Divider,
  Button,
  List,
} from "antd";
import {
  RiseOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Area,
} from "recharts";

export default function SuccessAnalysisModal({ open, onClose, veri }) {
  const toplamGorev = veri.toplamGorev || 0;
  const bitenIsler = veri.bitenIsler || 0;
  const basariYuzde =
    toplamGorev > 0 ? Math.round((bitenIsler / toplamGorev) * 100) : 0;

  return (
    <Modal
      title={
        <span>
          <RiseOutlined style={{ color: "#52c41a", marginRight: 8 }} />
          Başarı Analizi - Detaylı Rapor
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Genel Performans">
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <Progress
                type="circle"
                percent={basariYuzde}
                size={200}
                strokeColor={{
                  "0%": "#87d068",
                  "100%": "#52c41a",
                }}
                format={(percent) => (
                  <div>
                    <div
                      style={{
                        fontSize: 36,
                        fontWeight: "bold",
                        color: "#52c41a",
                      }}
                    >
                      {percent}%
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      Başarı Oranı
                    </div>
                  </div>
                )}
              />
            </div>

            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Statistic
                  title="Toplam Görev"
                  value={toplamGorev}
                  prefix={<FileTextOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Tamamlanan"
                  value={bitenIsler}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Devam Eden"
                  value={toplamGorev - bitenIsler}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#faad14" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Tamamlanma Süresi"
                  value={
                    toplamGorev > 0
                      ? Math.round((bitenIsler / toplamGorev) * 30)
                      : 0
                  }
                  suffix="gün"
                  prefix={<CalendarOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Departman Bazlı Performans">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { name: "IT", value: 85 },
                    { name: "Finans", value: 72 },
                    { name: "IK", value: 90 },
                    { name: "Satış", value: 65 },
                    { name: "Pazarlama", value: 78 },
                    { name: "Üretim", value: 88 },
                  ]}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#52c41a"
                    fill="#d9f7be"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <Divider />

            <List
              size="small"
              dataSource={veri.gorevDurumlari}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.durum}
                    description={`${item.count} görev`}
                  />
                  <Progress
                    percent={Math.round(
                      (parseInt(item.count) / (toplamGorev || 1)) * 100
                    )}
                    size="small"
                    style={{ width: 100 }}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Button type="primary" icon={<ExportOutlined />} size="large">
          Raporu Dışa Aktar
        </Button>
      </div>
    </Modal>
  );
}
