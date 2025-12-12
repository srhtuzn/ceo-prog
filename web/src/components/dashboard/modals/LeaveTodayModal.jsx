// src/components/dashboard/modals/LeaveTodayModal.jsx
import React from "react";
import { Modal, List, Avatar, Space, Tag, Badge } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function LeaveTodayModal({ open, onClose, izinDetay }) {
  return (
    <Modal
      title={
        <Space>
          <CalendarOutlined />
          <span>Bugün İzinde Olanlar</span>
          <Badge
            count={izinDetay.length}
            style={{ backgroundColor: "#1890ff" }}
          />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <List
        itemLayout="horizontal"
        dataSource={izinDetay}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <Avatar style={{ backgroundColor: "#1890ff" }}>
                  {item.talep_eden?.[0]}
                </Avatar>
              }
              title={item.talep_eden}
              description={
                <Space direction="vertical" size={2}>
                  <div>
                    <Tag color="blue">{item.tur}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {dayjs(item.baslangic_tarihi).format("DD.MM.YYYY")} -{" "}
                    {dayjs(item.bitis_tarihi).format("DD.MM.YYYY")}(
                    {item.gun_sayisi} gün)
                  </div>
                  <div style={{ fontSize: 11, color: "#999" }}>
                    Dönüş: {dayjs(item.bitis_tarihi).format("DD.MM.YYYY")}
                  </div>
                </Space>
              }
            />
          </List.Item>
        )}
      />
      {izinDetay.length === 0 && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <CalendarOutlined
            style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
          />
          <div style={{ color: "#999" }}>
            Bugün izinde olan personel bulunmamaktadır.
          </div>
        </div>
      )}
    </Modal>
  );
}
