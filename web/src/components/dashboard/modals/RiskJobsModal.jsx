// src/components/dashboard/modals/RiskJobsModal.jsx
import React from "react";
import {
  Modal,
  Tabs,
  Table,
  Badge,
  Space,
  Tag,
  Button,
  Card,
  Timeline,
} from "antd";
import { AlertOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function RiskJobsModal({ open, onClose, riskliIslerDetay }) {
  return (
    <Modal
      title={
        <Space>
          <AlertOutlined style={{ color: "#ff4d4f" }} />
          <span>Acil & Geciken İşler</span>
          <Badge
            count={riskliIslerDetay.length}
            style={{ backgroundColor: "#ff4d4f" }}
          />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: 20 }}
    >
      <Tabs
        items={[
          {
            key: "geciken",
            label: "Geciken İşler",
            children: (
              <Table
                dataSource={riskliIslerDetay.filter((r) =>
                  dayjs(r.tarih).isBefore(dayjs(), "day")
                )}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                columns={[
                  {
                    title: "İş",
                    dataIndex: "baslik",
                    render: (t, r) => (
                      <div>
                        <div style={{ fontWeight: "bold" }}>{t}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          <CalendarOutlined style={{ marginRight: 4 }} />
                          Teslim: {dayjs(r.tarih).format("DD.MM.YYYY")}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Durum",
                    render: (_, r) => {
                      const gecikmis = dayjs(r.tarih).isBefore(dayjs(), "day");
                      return (
                        <Tag color="red" icon={<AlertOutlined />}>
                          {gecikmis ? "GECİKTİ" : "YAKLAŞIYOR"}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: "Sorumlular",
                    dataIndex: "atananlar",
                    render: (a) => (
                      <div>
                        {Array.isArray(a) ? (
                          a.map((person, idx) => (
                            <Tag
                              key={idx}
                              color="blue"
                              style={{ marginBottom: 2 }}
                            >
                              {person}
                            </Tag>
                          ))
                        ) : (
                          <Tag color="default">Atanmadı</Tag>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: "Gecikme",
                    render: (_, r) => {
                      const gecikmeGun = dayjs().diff(dayjs(r.tarih), "day");
                      return (
                        <Tag color={gecikmeGun > 7 ? "red" : "orange"}>
                          {gecikmeGun} gün
                        </Tag>
                      );
                    },
                  },
                  {
                    title: "Aksiyon",
                    render: () => (
                      <Space>
                        <Button size="small" type="primary">
                          Hatırlat
                        </Button>
                        <Button size="small" danger>
                          Raporla
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "yaklasan",
            label: "Yaklaşan Teslimler (3 gün içinde)",
            children: (
              <Timeline
                mode="alternate"
                items={riskliIslerDetay
                  .filter((r) => {
                    const kalan = dayjs(r.tarih).diff(dayjs(), "day");
                    return kalan <= 3 && kalan >= 0;
                  })
                  .map((r) => {
                    const kalanGun = dayjs(r.tarih).diff(dayjs(), "day");
                    return {
                      color:
                        kalanGun === 0
                          ? "red"
                          : kalanGun === 1
                          ? "orange"
                          : "blue",
                      children: (
                        <Card
                          size="small"
                          style={{
                            background:
                              kalanGun === 0
                                ? "#fff2f0"
                                : kalanGun === 1
                                ? "#fff7e6"
                                : "#e6f7ff",
                          }}
                        >
                          <div style={{ fontWeight: "bold" }}>{r.baslik}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            Teslim: {dayjs(r.tarih).format("DD.MM.YYYY")}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 4 }}>
                            <Tag
                              color={
                                kalanGun === 0
                                  ? "red"
                                  : kalanGun === 1
                                  ? "orange"
                                  : "blue"
                              }
                            >
                              {kalanGun === 0
                                ? "BUGÜN!"
                                : `${kalanGun} gün kaldı`}
                            </Tag>
                          </div>
                        </Card>
                      ),
                    };
                  })}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}
