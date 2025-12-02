import { useState, useEffect } from "react";
import AuthPage from "./AuthPage";
import SatinAlma from "./SatinAlma";
import IzinYonetimi from "./IzinYonetimi";
import EkipYonetimi from "./EkipYonetimi";
import AdminDashboard from "./AdminDashboard";
import GorevYonetimi from "./GorevYonetimi";
import DosyaYoneticisi from "./DosyaYoneticisi";
import ProfilYonetimi from "./ProfilYonetimi";
import {
  DesktopOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  LogoutOutlined,
  BellOutlined,
  UserOutlined,
  DollarOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  FolderOpenOutlined,
  PlusCircleOutlined, // <-- YENİ İKON
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
  Popover,
  Dropdown,
  Badge,
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
  const [bildirimler, setBildirimler] = useState([]);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);
  const [bildirimAcik, setBildirimAcik] = useState(false);

  const [hedefGorevId, setHedefGorevId] = useState(null);
  const [projeModalAcik, setProjeModalAcik] = useState(false);
  const [profilModalAcik, setProfilModalAcik] = useState(false);

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
      bildirimCek();
      projeCek();
    }
  }, [aktifKullanici]);

  const projeCek = () =>
    fetch(`${API_URL}/gorevler/projeler`)
      .then((res) => res.json())
      .then((data) => setProjeler(data));

  const kullaniciCek = () =>
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => setKullanicilar(data));

  const bildirimCek = () => {
    fetch(`${API_URL}/dashboard/bildirimler?kime=${aktifKullanici.ad_soyad}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBildirimler(data);
          setOkunmamisSayisi(data.filter((b) => !b.okundu).length);
        }
      });
  };

  const bildirimleriOkunduYap = () =>
    fetch(
      `${API_URL}/dashboard/bildirimler/hepsini-oku?kime=${aktifKullanici.ad_soyad}`,
      { method: "PUT" }
    ).then(() => {
      setOkunmamisSayisi(0);
      bildirimCek();
    });

  const projeKaydet = (degerler) => {
    const payload = {
      ...degerler,
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
        setProjeModalAcik(false);
        projeCek();
      });
  };

  const bildirimTikla = (bildirim) => {
    setBildirimAcik(false);
    if (bildirim.gorev_id) {
      setHedefGorevId(bildirim.gorev_id);
      setSayfa("list");
    } else {
      message.info(bildirim.mesaj);
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
            {/* --- YENİ PROJE EKLEME BUTONU (Sadece Yöneticiler) --- */}
            {yoneticiMi && (
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                onClick={() => setProjeModalAcik(true)}
              >
                Yeni Proje
              </Button>
            )}
            {/* --------------------------------------------------- */}

            <Popover
              content={
                <List
                  dataSource={bildirimler}
                  renderItem={(item) => (
                    <List.Item
                      onClick={() => bildirimTikla(item)}
                      style={{
                        background: item.okundu ? "white" : "#e6f7ff",
                        padding: 10,
                        cursor: "pointer",
                      }}
                    >
                      <List.Item.Meta
                        title={item.mesaj}
                        description={dayjs(item.tarih).format("HH:mm")}
                      />
                    </List.Item>
                  )}
                />
              }
              title="Bildirimler"
              trigger="click"
              open={bildirimAcik}
              onOpenChange={(v) => {
                setBildirimAcik(v);
                if (v) bildirimleriOkunduYap();
              }}
            >
              <Badge count={okunmamisSayisi}>
                <Button shape="circle" icon={<BellOutlined />} />
              </Badge>
            </Popover>
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
              bildirimler={bildirimler}
              acilacakGorevId={hedefGorevId}
              viewMode={sayfa}
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

      <Modal
        title="Yeni Proje Başlat"
        open={projeModalAcik}
        onCancel={() => setProjeModalAcik(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={projeKaydet}>
          <Form.Item name="ad" label="Proje Adı" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
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
          <Form.Item name="tarih" label="Süre">
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Oluştur
          </Button>
        </Form>
      </Modal>

      <ProfilYonetimi
        acik={profilModalAcik}
        kapat={() => setProfilModalAcik(false)}
        aktifKullanici={aktifKullanici}
        guncelle={kullaniciGuncelle}
      />
    </Layout>
  );
}
export default App;
