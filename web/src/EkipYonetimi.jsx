import { useState, useEffect } from "react";
import {
  Table,
  Card,
  Avatar,
  Tag,
  Button,
  Modal,
  Select,
  message,
  Tabs,
  Tree,
  Space,
  Typography,
  Popconfirm,
  Tooltip,
  Form,
  Input,
  Row,
  Col,
  Badge,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  ApartmentOutlined,
  UnorderedListOutlined,
  UserDeleteOutlined,
  TeamOutlined,
  IdcardOutlined,
  DeleteOutlined, // <-- EKSİK OLAN İKON EKLENDİ
} from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

// Yetkili Roller
const YETKILI_ROLLER = [
  "Genel Müdür",
  "İnsan Kaynakları",
  "Yönetim",
  "Departman Müdürü",
];

export default function EkipYonetimi({ aktifKullanici }) {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [yoneticiModalAcik, setYoneticiModalAcik] = useState(false);
  const [duzenleModalAcik, setDuzenleModalAcik] = useState(false);
  const [seciliPersonel, setSeciliPersonel] = useState(null);
  const [yeniYonetici, setYeniYonetici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [form] = Form.useForm();

  // Güvenlik: Sadece belirli roller düzenleme yapabilir
  const yetkiliMi =
    YETKILI_ROLLER.includes(aktifKullanici?.rol) ||
    aktifKullanici?.departman === "Yönetim";

  useEffect(() => {
    veriCek();
  }, []);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/kullanicilar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setKullanicilar(data);
        setYukleniyor(false);
      });
  };

  // --- İŞLEMLER ---
  const yoneticiKaydet = () => {
    fetch(`${API_URL}/kullanicilar/yonetici-ata/${seciliPersonel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yonetici_id: yeniYonetici }),
    }).then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        message.success("Yönetici atandı");
        setYoneticiModalAcik(false);
        veriCek();
      } else {
        message.error(data.error || "Hata oluştu");
      }
    });
  };

  const yoneticiSil = (personelId) => {
    fetch(`${API_URL}/kullanicilar/yonetici-sil/${personelId}`, {
      method: "PUT",
    }).then(() => {
      message.success("Bağlantı kaldırıldı");
      veriCek();
    });
  };

  const kullaniciSil = (id) => {
    fetch(`${API_URL}/kullanicilar/${id}`, { method: "DELETE" }).then(() => {
      message.success("Personel silindi");
      veriCek();
    });
  };

  const kullaniciGuncelle = (values) => {
    fetch(`${API_URL}/kullanicilar/${seciliPersonel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).then(() => {
      message.success("Bilgiler güncellendi");
      setDuzenleModalAcik(false);
      veriCek();
    });
  };

  // --- MODAL AÇICILAR ---
  const yoneticiModalAc = (personel) => {
    setSeciliPersonel(personel);
    setYeniYonetici(personel.yonetici_id);
    setYoneticiModalAcik(true);
  };

  const duzenleModalAc = (personel) => {
    setSeciliPersonel(personel);
    setDuzenleModalAcik(true);
    // Formu bu kişinin bilgileriyle doldur
    setTimeout(() => form.setFieldsValue(personel), 100);
  };

  // --- TABLO KOLONLARI ---
  const columns = [
    {
      title: "Personel",
      dataIndex: "ad_soyad",
      render: (text, r) => (
        <Space>
          <Avatar
            src={r.avatar ? `${API_URL}/uploads/${r.avatar}` : null}
            style={{ backgroundColor: "#1890ff" }}
          >
            {r.ad_soyad[0]}
          </Avatar>
          <div>
            <Text strong style={{ display: "block" }}>
              {text}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Departman",
      dataIndex: "departman",
      render: (d) => <Tag>{d}</Tag>,
    },
    { title: "Pozisyon", dataIndex: "pozisyon" },
    {
      title: "Rol",
      dataIndex: "rol",
      render: (r) => (
        <Tag
          color={
            r === "Genel Müdür" ? "purple" : r === "Personel" ? "blue" : "cyan"
          }
        >
          {r}
        </Tag>
      ),
    },
    {
      title: "Durum",
      dataIndex: "hesap_durumu",
      render: (d) => (
        <Badge status={d === "Aktif" ? "success" : "error"} text={d} />
      ),
    },
    {
      title: "Yöneticisi",
      dataIndex: "yonetici_adi",
      render: (y, r) => (
        <Space>
          {y ? <Tag color="purple">{y}</Tag> : <Text type="secondary">-</Text>}
          {yetkiliMi && (
            <Tooltip title="Yönetici Değiştir">
              <Button
                size="small"
                type="text"
                icon={<TeamOutlined />}
                onClick={() => yoneticiModalAc(r)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "İşlem",
      render: (_, r) => {
        if (!yetkiliMi)
          return <span style={{ color: "#ccc", fontSize: 11 }}>Yetkisiz</span>;
        if (r.id === aktifKullanici.id)
          return (
            <span style={{ color: "#ccc", fontSize: 11 }}>Kendi kaydınız</span>
          );

        return (
          <Space>
            <Tooltip title="Düzenle">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={() => duzenleModalAc(r)}
              />
            </Tooltip>
            {r.yonetici_id && (
              <Tooltip title="Yöneticiyi Kaldır">
                <Popconfirm
                  title="Bağlantıyı kes?"
                  onConfirm={() => yoneticiSil(r.id)}
                >
                  <Button size="small" icon={<UserDeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
            <Tooltip title="Personeli Sil">
              <Popconfirm
                title="Kullanıcıyı silmek istiyor musunuz?"
                description="Bu işlem geri alınamaz!"
                onConfirm={() => kullaniciSil(r.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const agacOlustur = (items, parentId = null) => {
    return items
      .filter((item) => item.yonetici_id === parentId)
      .map((item) => ({
        title: (
          <span>
            <Avatar
              size="small"
              style={{ backgroundColor: "#87d068", marginRight: 5 }}
            >
              {item.ad_soyad[0]}
            </Avatar>
            {item.ad_soyad}{" "}
            <Text type="secondary" style={{ fontSize: 10 }}>
              ({item.pozisyon})
            </Text>
          </span>
        ),
        key: item.id,
        children: agacOlustur(items, item.id),
      }));
  };
  const treeData = agacOlustur(kullanicilar);

  return (
    <div>
      <Card>
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: "1",
              label: (
                <span>
                  <UnorderedListOutlined /> Personel Listesi
                </span>
              ),
              children: (
                <Table
                  dataSource={kullanicilar}
                  columns={columns}
                  rowKey="id"
                  loading={yukleniyor}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "2",
              label: (
                <span>
                  <ApartmentOutlined /> Organizasyon Şeması
                </span>
              ),
              children: (
                <div style={{ padding: 20, minHeight: 300 }}>
                  {treeData.length > 0 ? (
                    <Tree
                      showLine
                      defaultExpandAll
                      treeData={treeData}
                      selectable={false}
                    />
                  ) : (
                    <div style={{ textAlign: "center", color: "#999" }}>
                      Henüz hiyerarşi oluşmadı. Genel Müdürün yöneticisi BOŞ
                      olmalı, diğerleri ona bağlanmalı.
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* --- YÖNETİCİ ATAMA PENCERESİ --- */}
      <Modal
        title="Yönetici Ata"
        open={yoneticiModalAcik}
        onCancel={() => setYoneticiModalAcik(false)}
        onOk={yoneticiKaydet}
      >
        <p>
          <strong>{seciliPersonel?.ad_soyad}</strong> (
          {seciliPersonel?.pozisyon}) için yönetici seçiniz:
        </p>
        <Select
          style={{ width: "100%" }}
          placeholder="Yönetici Seç"
          value={yeniYonetici}
          onChange={setYeniYonetici}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {kullanicilar
            .filter((k) => k.id !== seciliPersonel?.id)
            .map((k) => (
              <Option key={k.id} value={k.id}>
                {k.ad_soyad} - {k.pozisyon}
              </Option>
            ))}
        </Select>
      </Modal>

      {/* --- PERSONEL DÜZENLEME PENCERESİ (YENİ) --- */}
      <Modal
        title="Personel Bilgilerini Düzenle"
        open={duzenleModalAcik}
        onCancel={() => setDuzenleModalAcik(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={kullaniciGuncelle}>
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
              <Form.Item
                name="email"
                label="E-Posta"
                rules={[{ required: true, type: "email" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="departman" label="Departman">
                <Select>
                  <Option value="Bilgi İşlem">Bilgi İşlem</Option>
                  <Option value="Muhasebe">Muhasebe</Option>
                  <Option value="Satış">Satış</Option>
                  <Option value="Yönetim">Yönetim</Option>
                  <Option value="İK">İnsan Kaynakları</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pozisyon" label="Pozisyon">
                <Input />
              </Form.Item>
            </Col>

            {/* YÖNETİCİLERE ÖZEL ALANLAR */}
            <Col span={12}>
              <Form.Item name="rol" label="Sistem Rolü">
                <Select>
                  <Option value="Personel">Personel</Option>
                  <Option value="Süpervizör">Süpervizör</Option>
                  <Option value="Departman Müdürü">Departman Müdürü</Option>
                  <Option value="Genel Müdür">Genel Müdür</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hesap_durumu" label="Hesap Durumu">
                <Select>
                  <Option value="Aktif">Aktif</Option>
                  <Option value="Pasif">Pasif (Giriş Yapamaz)</Option>
                  <Option value="Bekliyor">Bekliyor</Option>
                  <Option value="Reddedildi">Reddedildi</Option>
                </Select>
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
      </Modal>
    </div>
  );
}
