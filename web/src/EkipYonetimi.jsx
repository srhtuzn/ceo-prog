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
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  ApartmentOutlined,
  UnorderedListOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

// Yetkili Roller (Bunlar dışındakiler düzenleme yapamaz)
const YETKILI_ROLLER = [
  "Genel Müdür",
  "İnsan Kaynakları",
  "Yönetim",
  "Departman Müdürü",
];

export default function EkipYonetimi({ aktifKullanici }) {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [seciliPersonel, setSeciliPersonel] = useState(null);
  const [yeniYonetici, setYeniYonetici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Güvenlik: Kullanıcı yetkili mi?
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
        else setKullanicilar([]);
        setYukleniyor(false);
      });
  };

  // Yönetici Atama
  const yoneticiKaydet = () => {
    fetch(`${API_URL}/kullanicilar/yonetici-ata/${seciliPersonel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yonetici_id: yeniYonetici }),
    }).then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        message.success("Yönetici atandı");
        setModalAcik(false);
        veriCek();
      } else {
        message.error(data.error || "Hata oluştu");
      }
    });
  };

  // Yönetici Silme (Bağlantı Kesme)
  const yoneticiSil = (personelId) => {
    fetch(`${API_URL}/kullanicilar/yonetici-sil/${personelId}`, {
      method: "PUT",
    }).then(() => {
      message.success("Yönetici bağlantısı kaldırıldı");
      veriCek();
    });
  };

  const modalAc = (personel) => {
    setSeciliPersonel(personel);
    setYeniYonetici(personel.yonetici_id);
    setModalAcik(true);
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
              {r.rol}
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
    {
      title: "Yöneticisi",
      dataIndex: "yonetici_adi",
      render: (y) =>
        y ? <Tag color="purple">{y}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "İşlem",
      render: (_, r) => {
        // EĞER YETKİLİ DEĞİLSE BUTON GÖSTERME
        if (!yetkiliMi)
          return <span style={{ color: "#ccc", fontSize: 11 }}>Yetkisiz</span>;

        // Kendi yöneticisini değiştiremesin (Opsiyonel güvenlik)
        if (r.id === aktifKullanici.id)
          return (
            <span style={{ color: "#ccc", fontSize: 11 }}>Kendi kaydınız</span>
          );

        return (
          <Space>
            <Tooltip title="Yönetici Ata / Değiştir">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={() => modalAc(r)}
              />
            </Tooltip>

            {r.yonetici_id && (
              <Tooltip title="Yöneticiyi Kaldır">
                <Popconfirm
                  title="Bağlantıyı kes?"
                  onConfirm={() => yoneticiSil(r.id)}
                >
                  <Button size="small" danger icon={<UserDeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // --- AĞAÇ VERİSİNİ OLUŞTURMA MOTORU ---
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

  // Kök düğümleri bul (Yöneticisi olmayanlar en tepedir)
  // Not: Genel Müdürün yöneticisi NULL olmalıdır.
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

      {/* YÖNETİCİ ATAMA PENCERESİ */}
      <Modal
        title="Yönetici Ata"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
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
    </div>
  );
}
