import { useState } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Row,
  Col,
  Tabs,
  Avatar,
  Upload,
  message,
  Select,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  UploadOutlined,
  SaveOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

const API_URL = "http://localhost:3000";
const { Option } = Select;

export default function ProfilYonetimi({
  acik,
  kapat,
  aktifKullanici,
  guncelle,
}) {
  const [form] = Form.useForm();

  const kullaniciGuncelle = (values) => {
    fetch(`${API_URL}/auth/profil/${aktifKullanici.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).then(async (res) => {
      if (res.ok) {
        const updatedUser = await res.json();
        // Şifre hariç diğer bilgileri güncelle
        const sonHal = { ...aktifKullanici, ...updatedUser };
        guncelle(sonHal); // App.jsx'teki state'i güncelle
        message.success("Bilgiler güncellendi");
      } else {
        message.error("Hata oluştu");
      }
    });
  };

  const sifreDegistir = (values) => {
    if (values.yeniSifre !== values.yeniSifreTekrar) {
      return message.error("Yeni şifreler uyuşmuyor!");
    }
    fetch(`${API_URL}/auth/sifre/${aktifKullanici.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).then(async (res) => {
      if (res.ok) {
        message.success("Şifre değiştirildi");
        form.resetFields();
      } else {
        const msg = await res.text();
        message.error(msg);
      }
    });
  };

  const fotoYukle = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch(`${API_URL}/auth/avatar/${aktifKullanici.id}`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const guncelKullanici = { ...aktifKullanici, avatar: data.avatar };
        guncelle(guncelKullanici); // App.jsx'teki state'i güncelle
        message.success("Fotoğraf güncellendi");
        onSuccess("ok");
      } else {
        onError("Hata");
        message.error("Yükleme başarısız");
      }
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Modal
      title="Hesap Ayarları"
      open={acik}
      onCancel={kapat}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "Genel Bilgiler",
            children: (
              <Form
                layout="vertical"
                initialValues={aktifKullanici}
                onFinish={kullaniciGuncelle}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="ad_soyad"
                      label="Ad Soyad"
                      rules={[{ required: true }]}
                    >
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="E-Posta">
                      <Input disabled prefix={<MailOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="departman" label="Departman">
                      <Input disabled /> {/* Departman değişimi İK'dan olur */}
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="pozisyon" label="Pozisyon">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                </Row>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  icon={<IdcardOutlined />}
                >
                  Bilgileri Güncelle
                </Button>
              </Form>
            ),
          },
          {
            key: "2",
            label: "Profil Fotoğrafı",
            children: (
              <div style={{ textAlign: "center", padding: 20 }}>
                <Avatar
                  size={120}
                  src={
                    aktifKullanici.avatar
                      ? `${API_URL}/uploads/${aktifKullanici.avatar}`
                      : null
                  }
                  style={{
                    backgroundColor: "#1890ff",
                    marginBottom: 20,
                    fontSize: 40,
                  }}
                >
                  {aktifKullanici.ad_soyad ? aktifKullanici.ad_soyad[0] : "U"}
                </Avatar>
                <br />
                <Upload showUploadList={false} customRequest={fotoYukle}>
                  <Button icon={<UploadOutlined />}>Yeni Fotoğraf Yükle</Button>
                </Upload>
              </div>
            ),
          },
          {
            key: "3",
            label: "Güvenlik",
            children: (
              <Form layout="vertical" onFinish={sifreDegistir}>
                <Form.Item
                  name="eskiSifre"
                  label="Mevcut Şifre"
                  rules={[{ required: true }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="yeniSifre"
                  label="Yeni Şifre"
                  rules={[{ required: true }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="yeniSifreTekrar"
                  label="Yeni Şifre (Tekrar)"
                  rules={[{ required: true }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Button
                  type="primary"
                  danger
                  htmlType="submit"
                  block
                  icon={<SaveOutlined />}
                >
                  Şifreyi Değiştir
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
}
