import { useState, useEffect } from "react";
import AuthPage from "./AuthPage";
import SatinAlma from "./SatinAlma";
import IzinYonetimi from "./IzinYonetimi";
import EkipYonetimi from "./EkipYonetimi";
import AdminDashboard from "./AdminDashboard";
import GorevYonetimi from "./GorevYonetimi";
import DosyaYoneticisi from "./DosyaYoneticisi";
import ProfilYonetimi from "./ProfilYonetimi";
import BildirimYonetimi from "./BildirimYonetimi";
import ChatWidget from "./ChatWidget";
import {
  DesktopOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  LogoutOutlined,
  UserOutlined,
  DollarOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  FolderOpenOutlined,
  PlusCircleOutlined,
  DeleteOutlined,
  ProjectOutlined,
  SaveOutlined,
  PlusOutlined, // <-- Yeni İş butonu için
  FolderAddOutlined, // <-- Proje butonu için
} from "@ant-design/icons";
import {
  Layout,
  Menu,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  List,
  Avatar,
  Space,
  Typography,
  Dropdown,
  Tabs,
  Popconfirm,
  Table,
  Tag,
  Row,
  Col,
} from "antd";
import dayjs from "dayjs";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const API_URL = "http://localhost:3000";

function App() {
  const [aktifKullanici, setAktifKullanici] = useState(
    JSON.parse(localStorage.getItem("wf_user")) || null
  );
  const [collapsed, setCollapsed] = useState(false);

  const cikisYap = () => {
    localStorage.removeItem("wf_user");
    setAktifKullanici(null);
    window.location.reload();
  };
  const kullaniciGuncelle = (yeniKullanici) => {
    setAktifKullanici(yeniKullanici);
    localStorage.setItem("wf_user", JSON.stringify(yeniKullanici));
  };

  const [sayfa, setSayfa] = useState("dashboard");
  const [projeler, setProjeler] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);

  const [hedefGorevId, setHedefGorevId] = useState(null);
  const [projeModalAcik, setProjeModalAcik] = useState(false);
  const [profilModalAcik, setProfilModalAcik] = useState(false);
  const [aktifTab, setAktifTab] = useState("1");
  const [yeniIsModalAcik, setYeniIsModalAcik] = useState(false); // Yeni İş Modalı için State

  // DEBUG İÇİN: Konsola kullanıcının rolünü yazdırıyorum
  console.log("Giriş Yapan Rol:", aktifKullanici?.rol);

  const YONETICILER = [
    "Genel Müdür",
    "Departman Müdürü",
    "Süpervizör",
    "Yönetici",
  ];
  const yoneticiMi = YONETICILER.includes(aktifKullanici?.rol);

  const menuItems = [
    { key: "dashboard", icon: <DesktopOutlined />, label: "Ana Sayfa" },
    {
      key: "gorevler",
      icon: <AppstoreOutlined />,
      label: "İş Yönetimi",
      children: [
        {
          key: "list",
          label: "Liste Görünümü",
          icon: <UnorderedListOutlined />,
        },
        { key: "board", label: "Pano Görünümü", icon: <AppstoreOutlined /> },
        { key: "calendar", label: "Takvim", icon: <CalendarOutlined /> },
      ],
    },
    {
      key: "satinalma",
      icon: <DollarOutlined />,
      label: "Satın Alma / Finans",
    },
    { key: "izinler", icon: <TeamOutlined />, label: "İK / İzin Yönetimi" },
    {
      key: "ekip",
      icon: <UsergroupAddOutlined />,
      label: "Ekip / Organizasyon",
    },
    {
      key: "drive",
      icon: <FolderOpenOutlined />,
      label: "Şirket Arşivi / Drive",
    },
  ];

  const userMenu = {
    items: [
      {
        key: "profil",
        label: "Hesap Ayarları",
        icon: <UserOutlined />,
        onClick: () => setProfilModalAcik(true),
      },
      { type: "divider" },
      {
        key: "cikis",
        label: "Çıkış Yap",
        icon: <LogoutOutlined />,
        danger: true,
        onClick: cikisYap,
      },
    ],
  };

  useEffect(() => {
    if (aktifKullanici) {
      kullaniciCek();
      projeCek();
    }
  }, [aktifKullanici]);

  const projeCek = () =>
    fetch(`${API_URL}/gorevler/projeler`)
      .then((res) => res.json())
      .then((data) => setProjeler(Array.isArray(data) ? data : []));

  const kullaniciCek = () =>
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => setKullanicilar(data));

  const projeKaydet = (degerler) => {
    const payload = {
      ad: degerler.ad,
      departman: degerler.departman,
      olusturan: aktifKullanici.ad_soyad,
      baslangic_tarihi: degerler.tarih
        ? degerler.tarih[0].format("YYYY-MM-DD")
        : null,
      bitis_tarihi: degerler.tarih
        ? degerler.tarih[1].format("YYYY-MM-DD")
        : null,
    };

    fetch(`${API_URL}/gorevler/projeler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        message.success("Proje oluşturuldu");
        projeCek();
        setAktifTab("1");
      })
      .catch(() => message.error("Proje kaydedilemedi"));
  };

  const projeSil = (id) => {
    fetch(`${API_URL}/gorevler/projeler/${id}`, { method: "DELETE" }).then(
      () => {
        message.success("Proje silindi");
        projeCek();
      }
    );
  };

  const handleBildirimNavigasyon = (gorevId) => {
    if (gorevId) {
      setHedefGorevId(gorevId);
      setSayfa("list");
    }
  };

  if (!aktifKullanici)
    return (
      <AuthPage
        onLoginSuccess={(user) => {
          localStorage.setItem("wf_user", JSON.stringify(user));
          setAktifKullanici(user);
        }}
      />
    );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
            textAlign: "center",
            color: "white",
            lineHeight: "32px",
            fontWeight: "bold",
          }}
        >
          {collapsed ? "WF" : "WF PRO"}
        </div>
        <Menu
          theme="dark"
          defaultSelectedKeys={["dashboard"]}
          mode="inline"
          items={menuItems}
          onClick={(e) => setSayfa(e.key)}
        />
      </Sider>

      <Layout className="site-layout">
        <Header
          style={{
            padding: "0 20px",
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: 50,
            lineHeight: "50px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: "16px" }}
            />
            <Title level={5} style={{ margin: 0 }}>
              {sayfa === "dashboard"
                ? "Genel Bakış"
                : sayfa === "satinalma"
                ? "Satın Alma / Finans"
                : sayfa === "izinler"
                ? "İK / İzin Yönetimi"
                : sayfa === "ekip"
                ? "Ekip / Organizasyon"
                : "Görev Yönetimi"}
            </Title>
          </div>

          <Space>
            {/* --- PROJE YÖNETİM BUTONU (HERKES GÖRSÜN DİYE KONTROLÜ KALDIRDIM) --- */}
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => {
                setProjeModalAcik(true);
                setAktifTab("1");
              }}
            >
              Projeler
            </Button>
            {/* ------------------------------------------------------------------- */}

            <BildirimYonetimi
              aktifKullanici={aktifKullanici}
              onNavigasyon={handleBildirimNavigasyon}
            />

            <Dropdown menu={userMenu} trigger={["click"]}>
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  marginLeft: 15,
                  paddingLeft: 15,
                  borderLeft: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    textAlign: "right",
                    marginRight: 10,
                    lineHeight: "1.2",
                  }}
                >
                  <Text strong style={{ display: "block" }}>
                    {aktifKullanici.ad_soyad}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {aktifKullanici.departman}
                  </Text>
                </div>
                <Avatar
                  size="large"
                  src={
                    aktifKullanici.avatar
                      ? `${API_URL}/uploads/${aktifKullanici.avatar}`
                      : null
                  }
                  style={{ backgroundColor: "#1890ff" }}
                >
                  {aktifKullanici.ad_soyad ? aktifKullanici.ad_soyad[0] : "U"}
                </Avatar>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: "16px" }}>
          {sayfa === "dashboard" &&
            (yoneticiMi ? (
              <AdminDashboard />
            ) : (
              <div style={{ padding: 50, textAlign: "center" }}>
                <Title level={2}>Merhaba, {aktifKullanici.ad_soyad} 👋</Title>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => setSayfa("list")}
                >
                  Görevlerime Git
                </Button>
              </div>
            ))}

          {(sayfa === "list" || sayfa === "board" || sayfa === "calendar") && (
            <GorevYonetimi
              aktifKullanici={aktifKullanici}
              projeler={projeler}
              kullanicilar={kullanicilar}
              acilacakGorevId={hedefGorevId}
              viewMode={sayfa}
              projeModalAc={() => {
                setProjeModalAcik(true);
                setAktifTab("1");
              }}
            />
          )}
          {sayfa === "drive" && (
            <DosyaYoneticisi aktifKullanici={aktifKullanici} />
          )}
          {sayfa === "satinalma" && (
            <SatinAlma aktifKullanici={aktifKullanici} />
          )}
          {sayfa === "izinler" && (
            <IzinYonetimi aktifKullanici={aktifKullanici} />
          )}
          {sayfa === "ekip" && <EkipYonetimi aktifKullanici={aktifKullanici} />}
        </Content>
      </Layout>

      {/* --- PROJE YÖNETİM MODALI --- */}
      <Modal
        title="Proje Yönetimi"
        open={projeModalAcik}
        onCancel={() => setProjeModalAcik(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Tabs
          activeKey={aktifTab}
          onChange={setAktifTab}
          items={[
            {
              key: "1",
              label: (
                <span>
                  <UnorderedListOutlined /> Mevcut Projeler
                </span>
              ),
              children: (
                <Table
                  dataSource={projeler}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  columns={[
                    {
                      title: "Proje Adı",
                      dataIndex: "ad",
                      render: (t) => <b>{t}</b>,
                    },
                    {
                      title: "Departman",
                      dataIndex: "departman",
                      render: (d) => <Tag>{d}</Tag>,
                    },
                    {
                      title: "Tarihler",
                      render: (_, r) => (
                        <div style={{ fontSize: 11, color: "#666" }}>
                          {r.baslangic_tarihi
                            ? dayjs(r.baslangic_tarihi).format("DD.MM.YY")
                            : "?"}{" "}
                          -{" "}
                          {r.bitis_tarihi
                            ? dayjs(r.bitis_tarihi).format("DD.MM.YY")
                            : "?"}
                        </div>
                      ),
                    },
                    {
                      title: "Durum",
                      render: (_, r) => {
                        const bitis = dayjs(r.bitis_tarihi);
                        const bugun = dayjs();
                        const bittiMi = r.bitis_tarihi && bitis.isBefore(bugun);
                        return bittiMi ? (
                          <Tag color="red">Süresi Doldu</Tag>
                        ) : (
                          <Tag color="green">Aktif</Tag>
                        );
                      },
                    },
                    {
                      title: "İşlem",
                      align: "center",
                      render: (_, r) => (
                        <Popconfirm
                          title="Projeyi silmek istediğinize emin misiniz?"
                          description="Projeye bağlı görevler silinmez, 'Genel' boşa düşer."
                          onConfirm={() => projeSil(r.id)}
                          okText="Evet, Sil"
                          cancelText="İptal"
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "2",
              label: (
                <span>
                  <PlusCircleOutlined /> Yeni Oluştur
                </span>
              ),
              children: (
                <Form layout="vertical" onFinish={projeKaydet}>
                  <Form.Item
                    name="ad"
                    label="Proje Adı"
                    rules={[
                      { required: true, message: "Lütfen proje adı girin" },
                    ]}
                  >
                    <Input
                      placeholder="Örn: 2025 Web Sitesi Yenileme"
                      prefix={<ProjectOutlined />}
                    />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="departman"
                        label="Departman"
                        initialValue={aktifKullanici.departman}
                      >
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
                      <Form.Item name="tarih" label="Proje Süresi">
                        <DatePicker.RangePicker style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    icon={<SaveOutlined />}
                  >
                    Projeyi Kaydet
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Modal>

      <ProfilYonetimi
        acik={profilModalAcik}
        kapat={() => setProfilModalAcik(false)}
        aktifKullanici={aktifKullanici}
        guncelle={kullaniciGuncelle}
      />
      <ChatWidget aktifKullanici={aktifKullanici} />
    </Layout>
  );
}
export default App;
