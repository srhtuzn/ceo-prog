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
  Space,
  Typography,
  Popconfirm,
  Tooltip,
  Form,
  Input,
  Row,
  Col,
  Empty,
  Divider,
} from "antd";
import {
  EditOutlined,
  ApartmentOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  IdcardOutlined,
  DeleteOutlined,
  BranchesOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

const DEPARTMAN_RENKLERI = {
  Yönetim: "#722ed1",
  "Bilgi İşlem": "#1890ff",
  Muhasebe: "#faad14",
  Satış: "#52c41a",
  İK: "#eb2f96",
  "İnsan Kaynakları": "#eb2f96",
};

// --- CSS: AĞAÇ YAPISI ---
const OrgChartStyles = () => (
  <style>{`
    .org-tree { display: flex; justify-content: center; padding-top: 20px; }
    .org-tree ul {
      padding-top: 20px; position: relative; transition: all 0.5s;
      display: flex; justify-content: center;
    }
    .org-tree li {
      float: left; text-align: center; list-style-type: none;
      position: relative; padding: 20px 5px 0 5px; transition: all 0.5s;
    }
    /* Çizgiler */
    .org-tree li::before, .org-tree li::after {
      content: ''; position: absolute; top: 0; right: 50%;
      border-top: 2px solid #ccc; width: 50%; height: 20px;
    }
    .org-tree li::after {
      right: auto; left: 50%; border-left: 2px solid #ccc;
    }
    .org-tree li:only-child::after, .org-tree li:only-child::before {
      display: none;
    }
    .org-tree li:only-child { padding-top: 0; }
    .org-tree li:first-child::before, .org-tree li:last-child::after {
      border: 0 none;
    }
    .org-tree li:last-child::before {
      border-right: 2px solid #ccc; border-radius: 0 5px 0 0;
    }
    .org-tree li:first-child::after {
      border-radius: 5px 0 0 0;
    }
    .org-tree ul ul::before {
      content: ''; position: absolute; top: 0; left: 50%;
      border-left: 2px solid #ccc; width: 0; height: 20px;
    }
    /* Kart Tasarımı */
    .org-card {
      border: 1px solid #d9d9d9; padding: 15px 10px; display: inline-block;
      border-radius: 8px; background: white; width: 200px;
      transition: all 0.3s; position: relative; z-index: 1;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .org-card:hover {
      box-shadow: 0 8px 15px rgba(0,0,0,0.2); transform: translateY(-3px);
      border-color: #1890ff; z-index: 99;
    }
    .org-avatar { margin-bottom: 8px; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  `}</style>
);

// --- NODE BİLEŞENİ ---
const OrgNode = ({ node, onEdit, onAssign }) => {
  const renk = DEPARTMAN_RENKLERI[node.departman] || "#8c8c8c";
  return (
    <li>
      <div className="org-card" style={{ borderTop: `4px solid ${renk}` }}>
        <Avatar
          src={node.avatar ? `${API_URL}/uploads/${node.avatar}` : null}
          size={54}
          className="org-avatar"
          style={{ backgroundColor: renk }}
        >
          {node.ad_soyad[0]}
        </Avatar>
        <div>
          <Text
            strong
            style={{ fontSize: 14, display: "block", marginBottom: 2 }}
          >
            {node.ad_soyad}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {node.pozisyon}
          </Text>
        </div>
        <div style={{ marginTop: 8 }}>
          <Tag color={renk}>{node.departman}</Tag>
        </div>

        {/* İşlemler */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Tooltip title="Düzenle">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(node)}
            />
          </Tooltip>
          <Tooltip title="Yönetici Ata (Manuel)">
            <Button
              size="small"
              icon={<BranchesOutlined />}
              onClick={() => onAssign(node)}
            />
          </Tooltip>
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

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

  const yetkiliMi =
    YETKILI_ROLLER.includes(aktifKullanici?.rol) ||
    aktifKullanici?.departman === "Yönetim";

  useEffect(() => {
    veriCek();
  }, []);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setKullanicilar(data);
        setYukleniyor(false);
      });
  };

  // --- AĞAÇ OLUŞTURMA (Backend'den gelen 'parent_id'ye göre) ---
  const hiyerarsiOlustur = (items) => {
    const map = {};
    const roots = [];

    // 1. Haritalama
    items.forEach((item) => {
      map[item.id] = { ...item, children: [] };
    });

    // 2. Bağlama
    items.forEach((item) => {
      // 'parent_id' backend'den hesaplanıp geliyor
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].children.push(map[item.id]);
      } else {
        // Parent'ı yoksa (veya bulunamadıysa) ROOT'tur.
        roots.push(map[item.id]);
      }
    });
    return roots;
  };

  const orgData = hiyerarsiOlustur(kullanicilar);

  // --- İŞLEMLER ---
  const yoneticiKaydet = () => {
    if (seciliPersonel.id === yeniYonetici)
      return message.error("Kendisi olamaz!");
    fetch(`${API_URL}/ik/kullanicilar/yonetici-ata/${seciliPersonel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yonetici_id: yeniYonetici }),
    }).then(() => {
      message.success("Yönetici atandı");
      setYoneticiModalAcik(false);
      veriCek();
    });
  };
  const yoneticiSil = (pid) => {
    fetch(`${API_URL}/ik/kullanicilar/yonetici-sil/${pid}`, {
      method: "PUT",
    }).then(() => {
      message.success("Otomatiğe döndü");
      veriCek();
    });
  };
  const kullaniciSil = (id) => {
    fetch(`${API_URL}/ik/kullanicilar/${id}`, { method: "DELETE" }).then(() => {
      message.success("Silindi");
      veriCek();
    });
  };
  const kullaniciGuncelle = (values) => {
    fetch(`${API_URL}/ik/kullanicilar/${seciliPersonel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).then(() => {
      message.success("Güncellendi");
      setDuzenleModalAcik(false);
      veriCek();
    });
  };
  const modalAc = (p, tip) => {
    setSeciliPersonel(p);
    if (tip === "yonetici") {
      setYeniYonetici(p.yonetici_id);
      setYoneticiModalAcik(true);
    } else {
      setDuzenleModalAcik(true);
      setTimeout(() => form.setFieldsValue(p), 100);
    }
  };

  const columns = [
    {
      title: "Personel",
      dataIndex: "ad_soyad",
      render: (t, r) => (
        <Space>
          <Avatar
            src={r.avatar ? `${API_URL}/uploads/${r.avatar}` : null}
            style={{ backgroundColor: DEPARTMAN_RENKLERI[r.departman] }}
          >
            {t[0]}
          </Avatar>
          <div>
            <Text strong style={{ display: "block" }}>
              {t}
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
      render: (d) => <Tag color={DEPARTMAN_RENKLERI[d]}>{d}</Tag>,
    },
    {
      title: "Rol",
      dataIndex: "rol",
      render: (r) => (
        <Tag color={r === "Genel Müdür" ? "purple" : "geekblue"}>{r}</Tag>
      ),
    },
    {
      title: "İşlem",
      render: (_, r) =>
        yetkiliMi ? (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => modalAc(r, "duzenle")}
            />
            <Popconfirm title="Sil?" onConfirm={() => kullaniciSil(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Yetkisiz
          </Text>
        ),
    },
  ];

  return (
    <div>
      <OrgChartStyles />
      <Card>
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: "1",
              label: (
                <span>
                  <ApartmentOutlined /> Organizasyon Şeması
                </span>
              ),
              children: (
                <div
                  style={{
                    overflowX: "auto",
                    padding: "40px 0",
                    minHeight: 500,
                    textAlign: "center",
                    backgroundColor: "#f9f9f9",
                    borderRadius: 8,
                  }}
                >
                  {orgData.length > 0 ? (
                    <div className="org-tree">
                      <ul>
                        {orgData.map((node) => (
                          <OrgNode
                            key={node.id}
                            node={node}
                            onEdit={(p) => modalAc(p, "duzenle")}
                            onAssign={(p) => modalAc(p, "yonetici")}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Empty description="Personel bulunamadı" />
                  )}

                  {orgData.length > 1 && (
                    <div
                      style={{
                        marginTop: 30,
                        padding: 10,
                        display: "inline-block",
                        background: "#fff1f0",
                        border: "1px solid #ffa39e",
                        borderRadius: 4,
                      }}
                    >
                      <Text type="danger">
                        ⚠️ Dikkat: Şemada kopukluk var. "Genel Müdür" rolünde
                        sadece 1 kişi olduğundan ve diğerlerinin
                        departmanlarının doğru yazıldığından emin olun.
                      </Text>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "2",
              label: (
                <span>
                  <UnorderedListOutlined /> Liste Görünümü
                </span>
              ),
              children: (
                <Table
                  dataSource={kullanicilar}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  loading={yukleniyor}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* YÖNETİCİ MODAL */}
      <Modal
        title="Manuel Yönetici Atama"
        open={yoneticiModalAcik}
        onCancel={() => setYoneticiModalAcik(false)}
        onOk={yoneticiKaydet}
      >
        <Text type="secondary">
          Genelde sistem otomatiktir. Sadece istisnai durumlarda buradan manuel
          yönetici seçiniz.
        </Text>
        <div style={{ marginTop: 15 }}>
          <Select
            style={{ width: "100%" }}
            placeholder="Yönetici Seçiniz"
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
                  {k.ad_soyad} ({k.pozisyon})
                </Option>
              ))}
          </Select>
        </div>
        {seciliPersonel?.yonetici_id && (
          <Button
            type="link"
            danger
            onClick={() => yoneticiSil(seciliPersonel.id)}
            style={{ marginTop: 5 }}
          >
            Mevcut manuel atamayı kaldır
          </Button>
        )}
      </Modal>

      {/* DÜZENLEME MODALI */}
      <Modal
        title="Personel Bilgileri"
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
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="E-Posta">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="departman" label="Departman">
                <Select>
                  {Object.keys(DEPARTMAN_RENKLERI).map((d) => (
                    <Option key={d} value={d}>
                      {d}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rol" label="Rol (Önemli)">
                <Select>
                  <Option value="Personel">Personel</Option>
                  <Option value="Süpervizör">Süpervizör</Option>
                  <Option value="Departman Müdürü">Departman Müdürü</Option>
                  <Option value="Genel Müdür">Genel Müdür</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="pozisyon" label="Ünvan">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Button
            type="primary"
            htmlType="submit"
            block
            icon={<IdcardOutlined />}
          >
            Güncelle
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
