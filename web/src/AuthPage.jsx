import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Typography,
  message,
  Tabs,
  Checkbox,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;

export default function AuthPage({ onLoginSuccess }) {
  const [mod, setMod] = useState("login"); // 'login' veya 'register'
  const [yukleniyor, setYukleniyor] = useState(false);
  const [form] = Form.useForm();

  // Sekme (Tab) değişince modu güncelle
  const handleTabChange = (key) => {
    setMod(key);
    form.resetFields(); // Formu temizle
  };

  const onFinish = (values) => {
    setYukleniyor(true);
    const endpoint = mod === "login" ? "/auth/login" : "/auth/register";

    // Backend varsayılan olarak rolü 'Personel' atıyor, front-end'den göndermiyoruz.

    fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(async (res) => {
        setYukleniyor(false);
        if (res.ok) {
          const data = await res.json(); // Backend artık user + token dönüyor

          if (mod === "login") {
            message.success("Giriş Başarılı. Yönlendiriliyorsunuz...");

            // --- YENİ EKLENEN KISIM: Token ve Kullanıcıyı Kaydet ---
            localStorage.setItem("wf_user", JSON.stringify(data));
            localStorage.setItem("wf_token", data.token);
            // -------------------------------------------------------

            onLoginSuccess(data);
          } else {
            message.success("Kayıt Başarılı! Yönetici onayı bekleniyor.");
            // Kayıttan sonra otomatik giriş yaptırmıyoruz, onayı bekletiyoruz.
            // Kullanıcıyı login sekmesine atalım:
            setMod("login");
            form.resetFields();
          }
        } else {
          // Hata mesajını alırken backend'in json string döndürdüğünü varsayarak
          const msg = await res.text();
          // Tırnak işaretlerini temizle
          message.error(msg.replace(/"/g, "") || "İşlem başarısız");
        }
      })
      .catch(() => {
        setYukleniyor(false);
        message.error(
          "Sunucuya erişilemiyor! Lütfen bağlantınızı kontrol edin."
        );
      });
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #001529 0%, #1890ff 100%)", // Kurumsal Mavi Gradient
        padding: 20,
      }}
    >
      <Card
        bordered={false}
        style={{
          width: 440,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          borderRadius: 12,
        }}
      >
        {/* --- LOGO ALANI --- */}
        <div style={{ textAlign: "center", marginBottom: 30, marginTop: 10 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              background: "#e6f7ff",
              borderRadius: "50%",
              marginBottom: 15,
            }}
          >
            <SafetyCertificateOutlined
              style={{ fontSize: 32, color: "#1890ff" }}
            />
          </div>
          <Title level={2} style={{ margin: 0, color: "#001529" }}>
            WorkFlow PRO
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Kurumsal İş Takip & ERP Sistemi
          </Text>
        </div>

        {/* --- TABS (GİRİŞ / KAYIT) --- */}
        <Tabs
          activeKey={mod}
          onChange={handleTabChange}
          centered
          size="large"
          items={[
            {
              key: "login",
              label: "Giriş Yap",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={onFinish}
                  size="large"
                  style={{ marginTop: 20 }}
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: "Lütfen e-posta giriniz" },
                      { type: "email", message: "Geçerli bir e-posta değil" },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="E-posta Adresi"
                    />
                  </Form.Item>

                  <Form.Item
                    name="sifre"
                    rules={[
                      { required: true, message: "Lütfen şifre giriniz" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Şifre"
                    />
                  </Form.Item>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 24,
                    }}
                  >
                    <Checkbox>Beni Hatırla</Checkbox>
                    <a
                      onClick={(e) => e.preventDefault()}
                      style={{ color: "#1890ff" }}
                    >
                      Şifremi Unuttum
                    </a>
                  </div>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={yukleniyor}
                    style={{ height: 45, fontSize: 16, fontWeight: "bold" }}
                  >
                    GİRİŞ YAP
                  </Button>
                </Form>
              ),
            },
            {
              key: "register",
              label: "Personel Kaydı",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={onFinish}
                  size="large"
                  style={{ marginTop: 20 }}
                >
                  <Form.Item
                    name="ad_soyad"
                    rules={[{ required: true, message: "Ad Soyad zorunludur" }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Ad Soyad" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: "E-posta zorunludur" },
                      { type: "email", message: "Geçerli formatta giriniz" },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="E-posta Adresi"
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="departman"
                        rules={[{ required: true, message: "Seçiniz" }]}
                      >
                        <Select
                          placeholder="Departman"
                          suffixIcon={<BankOutlined />}
                        >
                          <Option value="Bilgi İşlem">Bilgi İşlem</Option>
                          <Option value="Muhasebe">Muhasebe</Option>
                          <Option value="Satış">Satış</Option>
                          <Option value="Yönetim">Yönetim</Option>
                          <Option value="İK">İnsan Kaynakları</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="pozisyon"
                        rules={[{ required: true, message: "Girilmelidir" }]}
                      >
                        <Input
                          prefix={<IdcardOutlined />}
                          placeholder="Ünvan"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="sifre"
                    rules={[
                      { required: true, message: "Şifre belirleyiniz" },
                      { min: 6, message: "En az 6 karakter olmalı" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Şifre Belirle"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={yukleniyor}
                    style={{
                      height: 45,
                      fontSize: 16,
                      fontWeight: "bold",
                      backgroundColor: "#52c41a",
                      borderColor: "#52c41a",
                    }}
                  >
                    KAYIT OL
                  </Button>
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 10,
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    Kayıt sonrası yönetici onayı gereklidir.
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>

      {/* Alt Bilgi */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          color: "rgba(255,255,255,0.6)",
          fontSize: 12,
        }}
      >
        © 2025 WorkFlow PRO v2.1 | Tüm Hakları Saklıdır
      </div>
    </div>
  );
}
