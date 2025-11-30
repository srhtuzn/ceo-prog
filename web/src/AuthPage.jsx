import { useState } from "react";
import { Card, Form, Input, Button, Select, Typography, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;

export default function AuthPage({ onLoginSuccess }) {
  const [mod, setMod] = useState("login"); // 'login' veya 'register'
  const [yukleniyor, setYukleniyor] = useState(false);

  const onFinish = (values) => {
    setYukleniyor(true);
    const endpoint = mod === "login" ? "/auth/login" : "/auth/register";

    fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(async (res) => {
        setYukleniyor(false);
        if (res.ok) {
          const user = await res.json();
          message.success(mod === "login" ? "Hoşgeldiniz!" : "Kayıt Başarılı!");
          // Başarılı olursa App.jsx'e haber ver
          onLoginSuccess(user);
        } else {
          const msg = await res.text(); // Backend'den gelen hata mesajı
          message.error(msg || "Bir hata oluştu");
        }
      })
      .catch(() => {
        setYukleniyor(false);
        message.error("Sunucuya bağlanılamadı!");
      });
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <SafetyCertificateOutlined
            style={{ fontSize: 40, color: "#1890ff" }}
          />
          <Title level={3}>WorkFlow PRO</Title>
          <Text type="secondary">
            {mod === "login" ? "Personel Girişi" : "Yeni Personel Kaydı"}
          </Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          {mod === "register" && (
            <>
              <Form.Item
                name="ad_soyad"
                rules={[{ required: true, message: "Ad Soyad giriniz" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Ad Soyad" />
              </Form.Item>
              <Form.Item name="departman" rules={[{ required: true }]}>
                <Select placeholder="Departman Seç">
                  <Option value="Bilgi İşlem">Bilgi İşlem</Option>
                  <Option value="Muhasebe">Muhasebe</Option>
                  <Option value="Satış">Satış</Option>
                  <Option value="Yönetim">Yönetim</Option>
                </Select>
              </Form.Item>
              {/* --- ROL SEÇİM ALANI (YENİ) --- */}
              <Form.Item
                name="rol"
                label="Sistem Rolü"
                rules={[{ required: true }]}
              >
                <Select placeholder="Rol Seçiniz">
                  <Option value="Personel">Personel</Option>
                  <Option value="Süpervizör">Süpervizör</Option>
                  <Option value="Departman Müdürü">Departman Müdürü</Option>
                  <Option value="Genel Müdür">Genel Müdür</Option>
                </Select>
              </Form.Item>
              <Form.Item name="pozisyon" rules={[{ required: true }]}>
                <Input placeholder="Pozisyon (Örn: Uzman)" />
              </Form.Item>
            </>
          )}

          <Form.Item name="email" rules={[{ required: true, type: "email" }]}>
            <Input prefix={<MailOutlined />} placeholder="E-posta Adresi" />
          </Form.Item>

          <Form.Item name="sifre" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Şifre" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={yukleniyor}
          >
            {mod === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </Button>
        </Form>

        <div style={{ marginTop: 15, textAlign: "center" }}>
          <a onClick={() => setMod(mod === "login" ? "register" : "login")}>
            {mod === "login"
              ? "Hesabın yok mu? Kayıt Ol"
              : "Zaten hesabın var mı? Giriş Yap"}
          </a>
        </div>
      </Card>
    </div>
  );
}
