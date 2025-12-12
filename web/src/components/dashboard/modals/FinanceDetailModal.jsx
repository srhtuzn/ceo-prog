// src/components/dashboard/modals/FinanceDetailModal.jsx
import React from "react";
import {
  Modal,
  Tabs,
  Table,
  Space,
  Tag,
  Badge,
  Row,
  Col,
  Card,
  Statistic,
  Button,
} from "antd";
import { DollarOutlined, EuroOutlined, PoundOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function FinanceDetailModal({
  open,
  onClose,
  finansDetay,
  finansDetaylari,
}) {
  return (
    <Modal
      title={
        <Space>
          <DollarOutlined />
          <span>Onay Bekleyen Ödemeler</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
    >
      <Tabs
        items={[
          {
            key: "tum",
            label: "Tüm Para Birimleri",
            children: (
              <Table
                dataSource={finansDetay}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: "Talep Eden",
                    dataIndex: "talep_eden",
                    render: (t) => <b>{t}</b>,
                  },
                  {
                    title: "Departman",
                    dataIndex: "departman",
                    render: (d) => <Tag color="blue">{d}</Tag>,
                  },
                  { title: "Başlık", dataIndex: "baslik" },
                  {
                    title: "Tutar",
                    render: (_, r) => (
                      <Space>
                        <Tag color="gold" style={{ fontWeight: "bold" }}>
                          {parseFloat(r.tutar).toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                          })}
                        </Tag>
                        <Tag color="cyan">{r.para_birimi}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: "Talep Tarihi",
                    dataIndex: "tarih",
                    render: (t) => dayjs(t).format("DD.MM.YYYY HH:mm"),
                  },
                  {
                    title: "İşlem",
                    render: () => (
                      <Space>
                        <Button type="primary" size="small">
                          Onayla
                        </Button>
                        <Button danger size="small">
                          Reddet
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          ...finansDetaylari.map((fin, idx) => ({
            key: `para-${idx}`,
            label: (
              <Space>
                {fin.paraBirimi === "USD" && (
                  <DollarOutlined style={{ color: "#52c41a" }} />
                )}
                {fin.paraBirimi === "EUR" && (
                  <EuroOutlined style={{ color: "#1890ff" }} />
                )}
                {fin.paraBirimi === "GBP" && (
                  <PoundOutlined style={{ color: "#ff4d4f" }} />
                )}
                {fin.paraBirimi === "TL" && <Tag color="gold">TL</Tag>}
                <span>{fin.paraBirimi}</span>
                <Badge
                  count={fin.bekleyenAdet}
                  style={{ backgroundColor: "#faad14" }}
                />
              </Space>
            ),
            children: (
              <div style={{ padding: 16 }}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Toplam Tutar"
                        value={fin.toplamTutar}
                        precision={2}
                        valueStyle={{ color: "#faad14", fontSize: 24 }}
                        suffix={fin.paraBirimi}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Bekleyen Talep"
                        value={fin.bekleyenAdet}
                        valueStyle={{ color: "#1890ff", fontSize: 24 }}
                        suffix="adet"
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Ortalama Tutar"
                        value={fin.toplamTutar / fin.bekleyenAdet}
                        precision={2}
                        valueStyle={{ color: "#52c41a", fontSize: 24 }}
                        suffix={fin.paraBirimi}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          })),
        ]}
      />
    </Modal>
  );
}
