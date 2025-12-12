import React from "react";
import { Modal, Table, Progress, Tag, Space, Typography, Badge } from "antd";
import { ProjectOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function ProjectDetailModal({ open, onClose, projeIlerleme }) {
  // Veri güvenliği kontrolü
  const veri = projeIlerleme || [];

  return (
    <Modal
      title={
        <Space>
          <ProjectOutlined style={{ color: "#1890ff" }} />
          <span>Tüm Projelerin Durumu</span>
          <Badge count={veri.length} style={{ backgroundColor: "#1890ff" }} />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <Table
        dataSource={veri}
        rowKey={(record) => record.id || record.ad} // ID yoksa ad'ı key yap
        pagination={{ pageSize: 8 }}
        columns={[
          {
            title: "Proje Adı",
            dataIndex: "ad",
            render: (text) => <Text strong>{text}</Text>,
          },
          {
            title: "Departman",
            dataIndex: "departman",
            render: (d) => (d ? <Tag color="blue">{d}</Tag> : <Tag>Genel</Tag>),
          },
          {
            title: "İlerleme Durumu",
            width: 250,
            render: (_, record) => {
              const biten = parseInt(record.biten_is) || 0;
              const toplam = parseInt(record.toplam_is) || 1;
              const yuzde = Math.round((biten / toplam) * 100);

              return (
                <div>
                  <Progress
                    percent={yuzde}
                    size="small"
                    status={yuzde === 100 ? "success" : "active"}
                  />
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    {biten} / {toplam} görev tamamlandı
                  </div>
                </div>
              );
            },
          },
          {
            title: "Durum",
            render: (_, record) => {
              const biten = parseInt(record.biten_is) || 0;
              const toplam = parseInt(record.toplam_is) || 1;
              const yuzde = Math.round((biten / toplam) * 100);

              if (yuzde === 100) return <Tag color="success">Tamamlandı</Tag>;
              if (yuzde > 50) return <Tag color="processing">İyi Gidiyor</Tag>;
              if (yuzde > 0) return <Tag color="warning">Devam Ediyor</Tag>;
              return <Tag color="default">Başlamadı</Tag>;
            },
          },
        ]}
      />
    </Modal>
  );
}
