// src/components/dashboard/ProjectProgressSection.jsx
import React from "react";
import {
  Card,
  Space,
  Typography,
  Collapse,
  Row,
  Col,
  Statistic,
  Progress,
  Button,
} from "antd";
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExpandOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  Tooltip as RechartsTooltip,
} from "recharts";

const { Text } = Typography;
const { Panel } = Collapse;

export default function ProjectProgressSection({
  projeIlerleme,
  onOpenProjeModal,
}) {
  return (
    <Card
      title={
        <Space>
          <ProjectOutlined />
          <Text strong>Proje İlerleme Durumları</Text>
        </Space>
      }
      extra={
        <Button
          type="link"
          onClick={onOpenProjeModal}
          icon={<ExpandOutlined />}
        >
          Detaylı Görünüm
        </Button>
      }
      style={{ borderRadius: 12 }}
    >
      {projeIlerleme?.length > 0 ? (
        <div>
          {/* PROJE BAZLI İLERLEME GRAFİĞİ */}
          <div style={{ height: 200, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projeIlerleme.slice(0, 5).map((p) => ({
                  name: p.ad,
                  tamamlanan: parseInt(p.biten_is) || 0,
                  toplam: parseInt(p.toplam_is) || 1,
                  oran: Math.round(
                    ((parseInt(p.biten_is) || 0) /
                      (parseInt(p.toplam_is) || 1)) *
                      100
                  ),
                }))}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === "oran" ? `${value}%` : value,
                    name === "oran"
                      ? "Tamamlanma Oranı"
                      : name === "tamamlanan"
                      ? "Tamamlanan Görev"
                      : "Toplam Görev",
                  ]}
                />
                <Bar dataKey="tamamlanan" name="Tamamlanan" fill="#52c41a" />
                <Bar dataKey="toplam" name="Toplam" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* DETAYLI PROJE LİSTESİ */}
          <Collapse ghost size="small">
            {projeIlerleme.map((item, index) => {
              const toplam = parseInt(item.toplam_is) || 1;
              const biten = parseInt(item.biten_is) || 0;
              const yuzde = Math.round((biten / toplam) * 100);

              return (
                <Panel
                  key={index}
                  header={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <Text strong>{item.ad}</Text>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {item.departman || "Departman Belirtilmemiş"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            color:
                              yuzde === 100
                                ? "#52c41a"
                                : yuzde > 50
                                ? "#1890ff"
                                : "#faad14",
                          }}
                        >
                          {yuzde}%
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {biten}/{toplam} görev
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div
                    style={{
                      background: "#f9f9f9",
                      padding: 12,
                      borderRadius: 6,
                    }}
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic
                          title="Tamamlanan"
                          value={biten}
                          valueStyle={{ color: "#52c41a" }}
                          prefix={<CheckCircleOutlined />}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="Devam Eden"
                          value={toplam - biten}
                          valueStyle={{ color: "#faad14" }}
                          prefix={<ClockCircleOutlined />}
                        />
                      </Col>
                    </Row>
                    <Progress
                      percent={yuzde}
                      strokeColor={
                        yuzde === 100
                          ? "#52c41a"
                          : yuzde > 50
                          ? "#1890ff"
                          : "#faad14"
                      }
                      status={yuzde === 100 ? "success" : "active"}
                      style={{ marginTop: 16 }}
                    />
                  </div>
                </Panel>
              );
            })}
          </Collapse>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>
          <ProjectOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>Henüz proje bulunmamaktadır.</div>
        </div>
      )}
    </Card>
  );
}
