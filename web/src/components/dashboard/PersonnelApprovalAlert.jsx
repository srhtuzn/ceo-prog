// src/components/dashboard/PersonnelApprovalAlert.jsx
import React from "react";
import { Card, Row, Col, Space, Button, Typography } from "antd";
import { UserAddOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function PersonnelApprovalAlert({
  bekleyenPersonel,
  onOpenModal,
}) {
  return (
    <Card
      style={{
        marginTop: 20,
        border: "1px solid #722ed1",
        background: "linear-gradient(90deg, #f9f0ff 0%, #fff 100%)",
      }}
    >
      <Row align="middle" justify="space-between">
        <Col>
          <Space>
            <UserAddOutlined style={{ color: "#722ed1", fontSize: 20 }} />
            <div>
              <Text strong style={{ color: "#722ed1" }}>
                {bekleyenPersonel.length} Yeni Personel Onayı Bekliyor
              </Text>
              <div style={{ fontSize: 12, color: "#666" }}>
                Personel kayıtlarını inceleyip onay vermelisiniz.
              </div>
            </div>
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            ghost
            onClick={onOpenModal}
            icon={<EyeOutlined />}
          >
            İncele
          </Button>
        </Col>
      </Row>
    </Card>
  );
}
