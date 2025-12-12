// src/components/dashboard/modals/PersonnelApprovalModal.jsx
import React from "react";
import { Modal, Table, Space, Button, Tag, Typography, Badge } from "antd";
import {
  UserAddOutlined,
  CheckCircleOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export default function PersonnelApprovalModal({
  open,
  onClose,
  bekleyenPersonel,
  personelOnayla,
}) {
  return (
    <Modal
      title={
        <Space>
          <UserAddOutlined style={{ color: "#722ed1" }} />
          <span>Personel Katılım İstekleri</span>
          <Badge
            count={bekleyenPersonel.length}
            style={{ backgroundColor: "#722ed1" }}
          />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <Table
        dataSource={bekleyenPersonel}
        rowKey="id"
        columns={[
          {
            title: "Ad Soyad",
            dataIndex: "ad_soyad",
            render: (text) => <Text strong>{text}</Text>,
          },
          {
            title: "Departman",
            dataIndex: "departman",
            render: (d) => <Tag color="blue">{d}</Tag>,
          },
          {
            title: "Pozisyon",
            dataIndex: "pozisyon",
            render: (p) => <Tag color="cyan">{p}</Tag>,
          },
          {
            title: "E-posta",
            dataIndex: "email",
            render: (email) => <a href={`mailto:${email}`}>{email}</a>,
          },
          {
            title: "İşlem",
            render: (_, r) => (
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => personelOnayla(r.id, "Aktif")}
                >
                  Onayla
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<StopOutlined />}
                  onClick={() => personelOnayla(r.id, "Reddedildi")}
                >
                  Reddet
                </Button>
                <Button
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={() => {
                    // Profil detayı görüntüleme
                  }}
                >
                  Detay
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
}
