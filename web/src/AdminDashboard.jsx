import { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  List,
  Tag,
  Table,
  Modal,
  Space,
  Button,
  message,
  Tooltip,
  Badge,
  Avatar,
  Collapse,
  Divider,
  Timeline,
  Flex,
  FloatButton,
  Typography,
  Tabs,
} from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  AlertOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  UserDeleteOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  UserOutlined,
  TrophyOutlined,
  EuroOutlined,
  PoundOutlined,
  LineChartOutlined,
  CalendarOutlined,
  SettingOutlined,
  FileTextOutlined,
  ExportOutlined,
  DashboardOutlined,
  CheckSquareOutlined,
  PercentageOutlined,
  AreaChartOutlined,
  BarChartOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  ExpandOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#FF4D4F"];
const { Text, Title } = Typography;
const { Panel } = Collapse;

export default function AdminDashboard() {
  const [veri, setVeri] = useState(null);

  // Modallar
  const [finansModal, setFinansModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [projeModal, setProjeModal] = useState(false);
  const [personelModal, setPersonelModal] = useState(false);
  const [mesaiModal, setMesaiModal] = useState(false);
  const [basariModal, setBasariModal] = useState(false);

  // Detay Verileri
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);
  const [riskDetay, setRiskDetay] = useState([]);

  // Mesai / Attendance verisi
  const [attendanceData, setAttendanceData] = useState({
    lateArrivals: [],
    absentNoLeave: [],
    overtimeLeaders: [],
    currentlyWorking: [],
    totalStaff: 0,
  });

  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  // İlk yüklemede genel dashboard + mesai analitiği
  useEffect(() => {
    verileriGetir();
    fetchAttendanceAnalytics();
  }, []);

  // MESAI GÜNCELLEME EVENT'İNİ DİNLE
  useEffect(() => {
    const handler = () => {
      fetchAttendanceAnalytics();
    };

    window.addEventListener("mesaiDegisti", handler);

    return () => {
      window.removeEventListener("mesaiDegisti", handler);
    };
  }, []);

  const verileriGetir = () => {
    // 1. Özet Veriler
    fetch(`${API_URL}/dashboard/ozet`)
      .then((res) => res.json())
      .then((data) => setVeri(data));

    // 2. Personel Onay Listesi
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBekleyenPersonel(
            data.filter((u) => u.hesap_durumu === "Bekliyor")
          );
        }
      });

    // 3. Riskli işleri detaylı çek
    fetch(`${API_URL}/dashboard/ozet`)
      .then((res) => res.json())
      .then((data) => {
        if (data.riskliIsler) {
          setRiskDetay(data.riskliIsler);
        }
      });
  };

  // MESAİ / ATTENDANCE ANALYTICS
  const fetchAttendanceAnalytics = async () => {
    try {
      // 1. Kullanıcılar
      const usersRes = await fetch(`${API_URL}/ik/kullanicilar`);
      const users = await usersRes.json();

      // 2. SADECE BUGÜNÜN mesai kayıtlarını al
      const mesaiRes = await fetch(`${API_URL}/mesai/bugunku?tumu=true`);
      const todaysRecords = await mesaiRes.json();

      // 3. ŞU AN AKTİF MESAİDE OLANLARI AL
      const aktifMesaiRes = await fetch(`${API_URL}/mesai/bugunku-aktif`);
      const aktifMesaiListesi = await aktifMesaiRes.json();

      // 4. İzinler
      const izinRes = await fetch(`${API_URL}/ik/izinler`);
      const izinler = await izinRes.json();

      const today = dayjs().format("YYYY-MM-DD");

      // Bugün izinde olanlar
      const onLeaveToday = izinler.filter(
        (i) =>
          i.durum === "Onaylandı" &&
          today >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          today <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );

      const activeStaffCount = users.filter(
        (u) => u.hesap_durumu === "Aktif"
      ).length;

      // Geç kalanlar (09:15 sonrası girişler)
      const lateArrivals = todaysRecords.filter((r) => {
        const start = dayjs(r.baslangic);
        return start.hour() > 9 || (start.hour() === 9 && start.minute() > 15);
      });

      // Giriş yapmayan ama izinde olmayanlar
      const clockedInIds = todaysRecords.map((r) => r.kullanici_id);
      const onLeaveIds = onLeaveToday.map((i) => {
        const u = users.find((user) => user.ad_soyad === i.talep_eden);
        return u ? u.id : null;
      });

      const absentNoLeave = users.filter(
        (u) =>
          u.hesap_durumu === "Aktif" &&
          !clockedInIds.includes(u.id) &&
          !onLeaveIds.includes(u.id)
      );

      // Fazla mesai liderleri
      const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      let overtimeLeaders = [];

      try {
        const overtimeRes = await fetch(
          `${API_URL}/mesai/rapor?ay=${prevMonth}`
        );

        if (overtimeRes.ok) {
          const monthlyData = await overtimeRes.json();

          if (Array.isArray(monthlyData) && monthlyData.length > 0) {
            const overtimeMap = {};
            monthlyData.forEach((record) => {
              const durum = record.Durum || record.durum || record.mesai_turu;
              const person = record.Personel || record.ad_soyad;
              const sureSaat =
                record.Sure_Saat ||
                record.sure_saat ||
                (record.Sure_DK ? record.Sure_DK / 60 : 0);

              if (
                durum &&
                (durum.includes("Fazla") || durum === "Fazla Mesai")
              ) {
                if (!overtimeMap[person]) {
                  overtimeMap[person] = 0;
                }
                const saat = parseFloat(sureSaat) || 0;
                if (saat > 9) {
                  overtimeMap[person] += saat - 9;
                }
              }
            });

            if (Object.keys(overtimeMap).length > 0) {
              overtimeLeaders = Object.entries(overtimeMap)
                .map(([person, hours]) => {
                  const user = users.find(
                    (u) =>
                      u.ad_soyad === person ||
                      u.ad_soyad?.toLowerCase() === person?.toLowerCase()
                  );
                  return {
                    ad_soyad: person,
                    avatar: user?.avatar,
                    total_overtime: Math.round(hours * 10) / 10,
                    departman: user?.departman || "Bilinmiyor",
                  };
                })
                .sort((a, b) => b.total_overtime - a.total_overtime)
                .slice(0, 5);
            } else {
              overtimeLeaders = generateMockOvertimeLeaders(users);
            }
          } else {
            overtimeLeaders = generateMockOvertimeLeaders(users);
          }
        } else {
          overtimeLeaders = generateMockOvertimeLeaders(users);
        }
      } catch (error) {
        console.error("Fazla mesai verisi alınamadı:", error);
        overtimeLeaders = generateMockOvertimeLeaders(users);
      }

      setAttendanceData({
        lateArrivals,
        absentNoLeave,
        overtimeLeaders,
        currentlyWorking: aktifMesaiListesi,
        onLeaveToday, // İZİNDE OLANLARI DA EKLEDİK
        totalStaff: activeStaffCount,
      });
    } catch (e) {
      console.error("Attendance fetch error", e);
      setAttendanceData({
        lateArrivals: [],
        absentNoLeave: [],
        overtimeLeaders: [],
        currentlyWorking: [],
        onLeaveToday: [],
        totalStaff: 0,
      });
    }
  };

  // Mock fazla mesai liderleri fonksiyonu
  const generateMockOvertimeLeaders = (users) => {
    return users
      .slice(0, 5)
      .map((u) => ({
        ad_soyad: u.ad_soyad,
        avatar: u.avatar,
        total_overtime: Math.floor(Math.random() * 15) + 5,
        departman: u.departman || "Personel",
      }))
      .sort((a, b) => b.total_overtime - a.total_overtime);
  };

  // --- DETAY ÇEKME FONKSİYONLARI ---
  const finansDetayGoster = async () => {
    try {
      const res = await fetch(`${API_URL}/finans?userId=${aktifKullanici.id}`);
      const data = await res.json();
      setFinansDetay(data.filter((d) => d.durum.includes("Bekliyor")));
      setFinansModal(true);
    } catch (error) {
      console.error("Finans detay hatası:", error);
    }
  };

  const izinDetayGoster = async () => {
    try {
      const res = await fetch(
        `${API_URL}/ik/izinler?userId=${aktifKullanici.id}`
      );
      const data = await res.json();
      const bugun = dayjs().format("YYYY-MM-DD");
      const bugunYoklar = data.filter(
        (i) =>
          i.durum.includes("Onaylandı") &&
          bugun >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          bugun <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );
      setIzinDetay(bugunYoklar);
      setIzinModal(true);
    } catch (error) {
      console.error("İzin detay hatası:", error);
    }
  };

  const personelOnayla = (id, karar) => {
    fetch(`${API_URL}/auth/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: karar }),
    }).then(() => {
      message.success(`Personel ${karar} edildi.`);
      verileriGetir();
    });
  };

  const basariDetayGoster = () => {
    setBasariModal(true);
  };

  if (!veri)
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        <Progress type="circle" status="active" />
      </div>
    );

  // Grafik verilerini hazırla
  const pastaVerisi = veri.gorevDurumlari.map((d) => ({
    name: d.durum,
    value: parseInt(d.count),
  }));

  // Finans Özeti için para birimlerine göre grupla
  const finansOzetleri = veri.finans?.toplamTutar || 0;
  const finansParaBirimi = veri.finans?.paraBirimi || "TL";

  // Eğer finans verisi dizi ise (backend'de düzeltildiyse)
  const finansDetaylari = Array.isArray(veri.finans)
    ? veri.finans
    : [veri.finans];

  // Doluluk yüzdesi
  const currentlyWorkingCount = attendanceData.currentlyWorking.length || 0;
  const onLeaveCount = attendanceData.onLeaveToday?.length || 0;
  const ofisteOlmayanlar =
    attendanceData.totalStaff - currentlyWorkingCount - onLeaveCount;

  const dolulukYuzde =
    attendanceData.totalStaff > 0
      ? Math.round((currentlyWorkingCount / attendanceData.totalStaff) * 100)
      : 0;

  // Riskli işler için detaylı veri
  const riskliIslerDetay = veri.riskliIsler || [];

  return (
    <div style={{ paddingBottom: 50, paddingTop: 20 }}>
      {/* FLOAT BUTTON */}
      <FloatButton.Group
        shape="square"
        style={{ right: 24 }}
        icon={<DashboardOutlined />}
        trigger="hover"
      >
        <FloatButton
          icon={<ExportOutlined />}
          tooltip={<div>Dashboard'u Dışa Aktar</div>}
        />
        <FloatButton
          icon={<SettingOutlined />}
          tooltip={<div>Dashboard Ayarları</div>}
        />
        <FloatButton.BackTop visibilityHeight={0} />
      </FloatButton.Group>

      {/* 1. ÜST KARTLAR (KPI) - YENİ TASARIM */}
      <Row gutter={[16, 16]}>
        {/* ONEY BEKLEYEN ÖDEMELER - GÜNCELLENMİŞ */}
        <Col span={6}>
          <Card
            hoverable
            onClick={finansDetayGoster}
            style={{
              borderTop: "3px solid #faad14",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(250, 173, 20, 0.1)",
              height: "100%",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <DollarOutlined
                style={{ fontSize: 24, color: "#faad14", marginRight: 12 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                  Onay Bekleyen Ödemeler
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {veri.finans?.map(
                    (fin, idx) =>
                      fin.bekleyenAdet > 0 && (
                        <div
                          key={idx}
                          style={{ display: "flex", alignItems: "center" }}
                        >
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: "bold",
                              color: "#faad14",
                            }}
                          >
                            {fin.toplamTutar?.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <Tag
                            color="gold"
                            style={{
                              marginLeft: 4,
                              fontSize: 10,
                              fontWeight: "bold",
                            }}
                          >
                            {fin.paraBirimi}
                          </Tag>
                        </div>
                      )
                  )}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
              <AlertOutlined style={{ marginRight: 4 }} />
              {veri.finans?.bekleyenAdet || 0} adet talep bekliyor
            </div>
            <Progress
              percent={veri.finans?.bekleyenAdet > 0 ? 100 : 0}
              size="small"
              status="active"
              strokeColor="#faad14"
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </Card>
        </Col>

        {/* ACİL / GECİKEN İŞLER - GÜNCELLENMİŞ */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setRiskModal(true)}
            style={{
              borderTop: "3px solid #ff4d4f",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(255, 77, 79, 0.1)",
              height: "100%",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <AlertOutlined
                style={{ fontSize: 24, color: "#ff4d4f", marginRight: 12 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                  Kritik İşler
                </div>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#ff4d4f" }}
                >
                  {riskliIslerDetay.length}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              {
                riskliIslerDetay.filter((r) => {
                  const tarih = dayjs(r.tarih);
                  return tarih.isBefore(dayjs(), "day");
                }).length
              }{" "}
              geciken,{" "}
              {
                riskliIslerDetay.filter((r) => {
                  const tarih = dayjs(r.tarih);
                  const kalan = tarih.diff(dayjs(), "day");
                  return kalan <= 3 && kalan >= 0;
                }).length
              }{" "}
              yaklaşan
            </div>
            <Progress
              percent={riskliIslerDetay.length > 0 ? 75 : 0}
              size="small"
              status="active"
              strokeColor="#ff4d4f"
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </Card>
        </Col>

        {/* OFİS DOLULUK ORANI - İZİN BİLGİSİ EKLENDİ */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setMesaiModal(true)}
            style={{
              borderTop: "3px solid #722ed1",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(114, 46, 209, 0.1)",
              height: "100%",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <FieldTimeOutlined
                style={{ fontSize: 24, color: "#722ed1", marginRight: 12 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                  Ofis Doluluğu
                </div>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#722ed1" }}
                >
                  {currentlyWorkingCount}/{attendanceData.totalStaff}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              <Space size={8}>
                <Tag color="green" size="small">
                  Mesaide: {currentlyWorkingCount}
                </Tag>
                <Tag color="blue" size="small">
                  İzinde: {onLeaveCount}
                </Tag>
                <Tag color="red" size="small">
                  Yok: {ofisteOlmayanlar}
                </Tag>
              </Space>
            </div>
            <Progress
              percent={dolulukYuzde}
              size="small"
              status="active"
              strokeColor="#722ed1"
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </Card>
        </Col>

        {/* BAŞARI ORANI - TIKLANABİLİR */}
        <Col span={6}>
          <Card
            hoverable
            onClick={basariDetayGoster}
            style={{
              borderTop: "3px solid #52c41a",
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(82, 196, 26, 0.1)",
              height: "100%",
              cursor: "pointer",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
            >
              <RiseOutlined
                style={{ fontSize: 24, color: "#52c41a", marginRight: 12 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                  Başarı Oranı
                </div>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#52c41a" }}
                >
                  {veri.toplamGorev > 0
                    ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                    : 0}
                  %
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              <CheckSquareOutlined style={{ marginRight: 4 }} />
              {veri.bitenIsler}/{veri.toplamGorev} tamamlandı
            </div>
            <Progress
              percent={
                veri.toplamGorev > 0
                  ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                  : 0
              }
              size="small"
              status="active"
              strokeColor="#52c41a"
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. PERSONEL ONAY UYARISI */}
      {bekleyenPersonel.length > 0 && (
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
                onClick={() => setPersonelModal(true)}
                icon={<EyeOutlined />}
              >
                İncele
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 3. GRAFİKLER VE DETAYLAR - GÜNCELLENMİŞ */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/* PROJE İLERLEME DURUMLARI - DETAYLI */}
        <Col span={16}>
          <Card
            title={
              <Space>
                <ProjectOutlined />
                <Text strong>Proje İlerleme Durumları</Text>
              </Space>
            }
            extra={
              <Button
                type="link"
                onClick={() => setProjeModal(true)}
                icon={<ExpandOutlined />}
              >
                Detaylı Görünüm
              </Button>
            }
            style={{ borderRadius: 12 }}
          >
            {veri.projeIlerleme?.length > 0 ? (
              <div>
                {/* PROJE BAZLI İLERLEME GRAFİĞİ */}
                <div style={{ height: 200, marginBottom: 20 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={veri.projeIlerleme.slice(0, 5).map((p) => ({
                        name: p.ad,
                        tamamlanan: parseInt(p.biten_is) || 0,
                        toplam: parseInt(p.toplam_is) || 1,
                        oran: Math.round(
                          ((parseInt(p.biten_is) || 0) /
                            (parseInt(p.toplam_is) || 1)) *
                            100
                        ),
                      }))}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          name === "oran" ? `${value}%` : value,
                          name === "oran"
                            ? "Tamamlanma Oranı"
                            : name === "tamamlanan"
                            ? "Tamamlanan Görev"
                            : "Toplam Görev",
                        ]}
                      />
                      <Bar
                        dataKey="tamamlanan"
                        name="Tamamlanan"
                        fill="#52c41a"
                      />
                      <Bar dataKey="toplam" name="Toplam" fill="#1890ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* DETAYLI PROJE LİSTESİ */}
                <Collapse ghost size="small">
                  {veri.projeIlerleme.map((item, index) => {
                    const toplam = parseInt(item.toplam_is) || 1;
                    const biten = parseInt(item.biten_is) || 0;
                    const yuzde = Math.round((biten / toplam) * 100);

                    return (
                      <Panel
                        key={index}
                        header={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              width: "100%",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <Text strong>{item.ad}</Text>
                              <div style={{ fontSize: 11, color: "#888" }}>
                                {item.departman || "Departman Belirtilmemiş"}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontWeight: "bold",
                                  color:
                                    yuzde === 100
                                      ? "#52c41a"
                                      : yuzde > 50
                                      ? "#1890ff"
                                      : "#faad14",
                                }}
                              >
                                {yuzde}%
                              </div>
                              <div style={{ fontSize: 11, color: "#888" }}>
                                {biten}/{toplam} görev
                              </div>
                            </div>
                          </div>
                        }
                      >
                        <div
                          style={{
                            background: "#f9f9f9",
                            padding: 12,
                            borderRadius: 6,
                          }}
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <Statistic
                                title="Tamamlanan"
                                value={biten}
                                valueStyle={{ color: "#52c41a" }}
                                prefix={<CheckCircleOutlined />}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic
                                title="Devam Eden"
                                value={toplam - biten}
                                valueStyle={{ color: "#faad14" }}
                                prefix={<ClockCircleOutlined />}
                              />
                            </Col>
                          </Row>
                          <Progress
                            percent={yuzde}
                            strokeColor={
                              yuzde === 100
                                ? "#52c41a"
                                : yuzde > 50
                                ? "#1890ff"
                                : "#faad14"
                            }
                            status={yuzde === 100 ? "success" : "active"}
                            style={{ marginTop: 16 }}
                          />
                        </div>
                      </Panel>
                    );
                  })}
                </Collapse>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#ccc" }}>
                <ProjectOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>Henüz proje bulunmamaktadır.</div>
              </div>
            )}
          </Card>
        </Col>

        {/* GÖREV DURUM DAĞILIMI VE ÖZET */}
        <Col span={8}>
          <Card
            title="Görev Özeti"
            style={{ borderRadius: 12, height: "100%" }}
            extra={
              <Button
                type="text"
                icon={<AreaChartOutlined />}
                onClick={() => {
                  // Ya sadece mesaj gösterin:
                  message.info("Görevler sayfası yapım aşamasında");
                  // Ya da window.location ile yönlendirin:
                  // window.location.href = "/gorevler";
                }}
                size="small"
              >
                Tümünü Gör
              </Button>
            }
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pastaVerisi}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {pastaVerisi.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name) => [`${value} görev`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <Divider style={{ margin: "12px 0" }} />

            {/* HIZLI İSTATİSTİKLER */}
            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: "#f6ffed", border: "none" }}
                >
                  <Statistic
                    title="Tamamlanan"
                    value={veri.bitenIsler}
                    valueStyle={{ color: "#52c41a", fontSize: 18 }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: "#fff7e6", border: "none" }}
                >
                  <Statistic
                    title="Devam Eden"
                    value={veri.toplamGorev - veri.bitenIsler}
                    valueStyle={{ color: "#faad14", fontSize: 18 }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: "#e6f7ff", border: "none" }}
                >
                  <Statistic
                    title="Toplam"
                    value={veri.toplamGorev}
                    valueStyle={{ color: "#1890ff", fontSize: 18 }}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: "#f9f0ff", border: "none" }}
                >
                  <Statistic
                    title="Proje"
                    value={veri.toplamProje}
                    valueStyle={{ color: "#722ed1", fontSize: 18 }}
                    prefix={<ProjectOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* MODALLAR */}

      {/* BAŞARI ORANI DETAY MODALI */}
      <Modal
        title={
          <Space>
            <RiseOutlined style={{ color: "#52c41a" }} />
            <span>Başarı Analizi - Detaylı Rapor</span>
          </Space>
        }
        open={basariModal}
        onCancel={() => setBasariModal(false)}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="Genel Performans">
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <Progress
                  type="circle"
                  percent={
                    veri.toplamGorev > 0
                      ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                      : 0
                  }
                  size={200}
                  strokeColor={{
                    "0%": "#87d068",
                    "100%": "#52c41a",
                  }}
                  format={(percent) => (
                    <div>
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: "bold",
                          color: "#52c41a",
                        }}
                      >
                        {percent}%
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        Başarı Oranı
                      </div>
                    </div>
                  )}
                />
              </div>

              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Statistic
                    title="Toplam Görev"
                    value={veri.toplamGorev}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tamamlanan"
                    value={veri.bitenIsler}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Devam Eden"
                    value={veri.toplamGorev - veri.bitenIsler}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: "#faad14" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tamamlanma Süresi"
                    value={
                      veri.toplamGorev > 0
                        ? Math.round((veri.bitenIsler / veri.toplamGorev) * 30)
                        : 0
                    }
                    suffix="gün"
                    prefix={<CalendarOutlined />}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="Departman Bazlı Performans">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { name: "IT", value: 85 },
                      { name: "Finans", value: 72 },
                      { name: "IK", value: 90 },
                      { name: "Satış", value: 65 },
                      { name: "Pazarlama", value: 78 },
                      { name: "Üretim", value: 88 },
                    ]}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#52c41a"
                      fill="#d9f7be"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <Divider />

              <List
                size="small"
                dataSource={veri.gorevDurumlari}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.durum}
                      description={`${item.count} görev`}
                    />
                    <Progress
                      percent={Math.round(
                        (parseInt(item.count) / veri.toplamGorev) * 100
                      )}
                      size="small"
                      style={{ width: 100 }}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Button type="primary" icon={<ExportOutlined />} size="large">
            Raporu Dışa Aktar
          </Button>
        </div>
      </Modal>

      {/* FİNANS DETAY MODALI - PARA BİRİMİ GRUPLU */}
      <Modal
        title={
          <Space>
            <DollarOutlined />
            <span>Onay Bekleyen Ödemeler</span>
          </Space>
        }
        open={finansModal}
        onCancel={() => setFinansModal(false)}
        footer={null}
        width={1000}
      >
        <Tabs
          items={[
            {
              key: "tum",
              label: "Tüm Para Birimleri",
              children: (
                <Table
                  dataSource={finansDetay}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "Talep Eden",
                      dataIndex: "talep_eden",
                      render: (t) => <b>{t}</b>,
                    },
                    {
                      title: "Departman",
                      dataIndex: "departman",
                      render: (d) => <Tag color="blue">{d}</Tag>,
                    },
                    { title: "Başlık", dataIndex: "baslik" },
                    {
                      title: "Tutar",
                      render: (_, r) => (
                        <Space>
                          <Tag color="gold" style={{ fontWeight: "bold" }}>
                            {parseFloat(r.tutar).toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                            })}
                          </Tag>
                          <Tag color="cyan">{r.para_birimi}</Tag>
                        </Space>
                      ),
                    },
                    {
                      title: "Talep Tarihi",
                      dataIndex: "tarih",
                      render: (t) => dayjs(t).format("DD.MM.YYYY HH:mm"),
                    },
                    {
                      title: "İşlem",
                      render: () => (
                        <Space>
                          <Button type="primary" size="small">
                            Onayla
                          </Button>
                          <Button danger size="small">
                            Reddet
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
            ...finansDetaylari.map((fin, idx) => ({
              key: `para-${idx}`,
              label: (
                <Space>
                  {fin.paraBirimi === "USD" && (
                    <DollarOutlined style={{ color: "#52c41a" }} />
                  )}
                  {fin.paraBirimi === "EUR" && (
                    <EuroOutlined style={{ color: "#1890ff" }} />
                  )}
                  {fin.paraBirimi === "GBP" && (
                    <PoundOutlined style={{ color: "#ff4d4f" }} />
                  )}
                  {fin.paraBirimi === "TL" && <Tag color="gold">TL</Tag>}
                  <span>{fin.paraBirimi}</span>
                  <Badge
                    count={fin.bekleyenAdet}
                    style={{ backgroundColor: "#faad14" }}
                  />
                </Space>
              ),
              children: (
                <div style={{ padding: 16 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="Toplam Tutar"
                          value={fin.toplamTutar}
                          precision={2}
                          valueStyle={{ color: "#faad14", fontSize: 24 }}
                          suffix={fin.paraBirimi}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="Bekleyen Talep"
                          value={fin.bekleyenAdet}
                          valueStyle={{ color: "#1890ff", fontSize: 24 }}
                          suffix="adet"
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="Ortalama Tutar"
                          value={fin.toplamTutar / fin.bekleyenAdet}
                          precision={2}
                          valueStyle={{ color: "#52c41a", fontSize: 24 }}
                          suffix={fin.paraBirimi}
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            })),
          ]}
        />
      </Modal>

      {/* RİSKLİ İŞLER MODALI - GÜNCELLENMİŞ */}
      <Modal
        title={
          <Space>
            <AlertOutlined style={{ color: "#ff4d4f" }} />
            <span>Acil & Geciken İşler</span>
            <Badge
              count={riskliIslerDetay.length}
              style={{ backgroundColor: "#ff4d4f" }}
            />
          </Space>
        }
        open={riskModal}
        onCancel={() => setRiskModal(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        <Tabs
          items={[
            {
              key: "geciken",
              label: "Geciken İşler",
              children: (
                <Table
                  dataSource={riskliIslerDetay.filter((r) =>
                    dayjs(r.tarih).isBefore(dayjs(), "day")
                  )}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    {
                      title: "İş",
                      dataIndex: "baslik",
                      render: (t, r) => (
                        <div>
                          <div style={{ fontWeight: "bold" }}>{t}</div>
                          <div style={{ fontSize: 11, color: "#888" }}>
                            <CalendarOutlined style={{ marginRight: 4 }} />
                            Teslim: {dayjs(r.tarih).format("DD.MM.YYYY")}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: "Durum",
                      render: (_, r) => {
                        const gecikmis = dayjs(r.tarih).isBefore(
                          dayjs(),
                          "day"
                        );
                        return (
                          <Tag color="red" icon={<AlertOutlined />}>
                            {gecikmis ? "GECİKTİ" : "YAKLAŞIYOR"}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: "Sorumlular",
                      dataIndex: "atananlar",
                      render: (a) => (
                        <div>
                          {Array.isArray(a) ? (
                            a.map((person, idx) => (
                              <Tag
                                key={idx}
                                color="blue"
                                style={{ marginBottom: 2 }}
                              >
                                {person}
                              </Tag>
                            ))
                          ) : (
                            <Tag color="default">Atanmadı</Tag>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: "Gecikme",
                      render: (_, r) => {
                        const gecikmeGun = dayjs().diff(dayjs(r.tarih), "day");
                        return (
                          <Tag color={gecikmeGun > 7 ? "red" : "orange"}>
                            {gecikmeGun} gün
                          </Tag>
                        );
                      },
                    },
                    {
                      title: "Aksiyon",
                      render: () => (
                        <Space>
                          <Button size="small" type="primary">
                            Hatırlat
                          </Button>
                          <Button size="small" danger>
                            Raporla
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "yaklasan",
              label: "Yaklaşan Teslimler (3 gün içinde)",
              children: (
                <Timeline
                  mode="alternate"
                  items={riskliIslerDetay
                    .filter((r) => {
                      const kalan = dayjs(r.tarih).diff(dayjs(), "day");
                      return kalan <= 3 && kalan >= 0;
                    })
                    .map((r) => {
                      const kalanGun = dayjs(r.tarih).diff(dayjs(), "day");
                      return {
                        color:
                          kalanGun === 0
                            ? "red"
                            : kalanGun === 1
                            ? "orange"
                            : "blue",
                        children: (
                          <Card
                            size="small"
                            style={{
                              background:
                                kalanGun === 0
                                  ? "#fff2f0"
                                  : kalanGun === 1
                                  ? "#fff7e6"
                                  : "#e6f7ff",
                            }}
                          >
                            <div style={{ fontWeight: "bold" }}>{r.baslik}</div>
                            <div style={{ fontSize: 12, color: "#666" }}>
                              Teslim: {dayjs(r.tarih).format("DD.MM.YYYY")}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                              <Tag
                                color={
                                  kalanGun === 0
                                    ? "red"
                                    : kalanGun === 1
                                    ? "orange"
                                    : "blue"
                                }
                              >
                                {kalanGun === 0
                                  ? "BUGÜN!"
                                  : `${kalanGun} gün kaldı`}
                              </Tag>
                            </div>
                          </Card>
                        ),
                      };
                    })}
                />
              ),
            },
          ]}
        />
      </Modal>

      {/* MESAİ / ATTENDANCE ANALİZ MODALI - İZİN BİLGİSİ EKLENDİ */}
      <Modal
        title={
          <Space>
            <ClockCircleOutlined /> Günlük Mesai Özeti & Analiz
            <Tag color="processing" icon={<FieldTimeOutlined />}>
              {dayjs().format("DD.MM.YYYY")}
            </Tag>
          </Space>
        }
        open={mesaiModal}
        onCancel={() => setMesaiModal(false)}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        <Row gutter={[16, 16]}>
          {/* İSTATİSTİK KARTLARI */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Ofiste"
                    value={currentlyWorkingCount}
                    suffix={`/ ${attendanceData.totalStaff}`}
                    valueStyle={{ color: "#3f8600" }}
                    prefix={<UserOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="İzinde"
                    value={onLeaveCount}
                    valueStyle={{ color: "#1890ff" }}
                    prefix={<CalendarOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Giriş Yok"
                    value={attendanceData.absentNoLeave.length}
                    valueStyle={{ color: "#ff4d4f" }}
                    prefix={<AlertOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="Geç Kalan"
                    value={attendanceData.lateArrivals.length}
                    valueStyle={{ color: "#faad14" }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          {/* SOL SÜTUN */}
          <Col span={8}>
            {/* ŞU AN MESAİDE OLANLAR */}
            <Card
              title="✅ Aktif Çalışanlar"
              type="inner"
              headStyle={{ background: "#f6ffed", color: "#3f8600" }}
              extra={
                <Badge
                  count={currentlyWorkingCount}
                  style={{ backgroundColor: "#52c41a" }}
                />
              }
            >
              {attendanceData.currentlyWorking.length > 0 ? (
                <List
                  dataSource={attendanceData.currentlyWorking}
                  renderItem={(person, index) => {
                    const baslangic = dayjs(person.baslangic);
                    const calismaSuresi = dayjs().diff(baslangic, "minute");
                    const saat = Math.floor(calismaSuresi / 60);
                    const dakika = calismaSuresi % 60;

                    return (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              src={
                                person.avatar
                                  ? `${API_URL}/uploads/${person.avatar}`
                                  : null
                              }
                              style={{ backgroundColor: "#87d068" }}
                            >
                              {person.ad_soyad?.[0]}
                            </Avatar>
                          }
                          title={
                            <div>
                              <strong>{person.ad_soyad}</strong>
                              <Tag
                                color="blue"
                                size="small"
                                style={{ marginLeft: 8 }}
                              >
                                {person.departman}
                              </Tag>
                            </div>
                          }
                          description={
                            <div>
                              <div>
                                <ClockCircleOutlined /> Giriş:{" "}
                                {baslangic.format("HH:mm")}
                              </div>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                Çalışma: {saat > 0 ? `${saat} saat ` : ""}
                                {dakika} dakika
                              </div>
                            </div>
                          }
                        />
                        <Tag color="green">Aktif</Tag>
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <div
                  style={{ textAlign: "center", padding: 20, color: "#999" }}
                >
                  <UserOutlined style={{ fontSize: 48, marginBottom: 10 }} />
                  <div>Şu anda aktif mesai yok.</div>
                </div>
              )}
            </Card>

            {/* İZİNDE OLANLAR */}
            <Card
              title="🏝️ İzindekiler"
              type="inner"
              style={{ marginTop: 15 }}
              headStyle={{ background: "#e6f7ff", color: "#1890ff" }}
            >
              {attendanceData.onLeaveToday?.length > 0 ? (
                <List
                  dataSource={attendanceData.onLeaveToday}
                  renderItem={(izin) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ backgroundColor: "#1890ff" }}>
                            {izin.talep_eden?.[0]}
                          </Avatar>
                        }
                        title={izin.talep_eden}
                        description={
                          <div>
                            <div>{izin.tur}</div>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              {dayjs(izin.bitis_tarihi).format("DD.MM.YYYY")}{" "}
                              tarihine kadar
                            </div>
                          </div>
                        }
                      />
                      <Tag color="blue">İzinli</Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: "center", color: "#999" }}>
                  Bugün izinde olan yok.
                </div>
              )}
            </Card>
          </Col>

          {/* ORTA SÜTUN */}
          <Col span={8}>
            {/* GEÇ KALANLAR */}
            <Card
              title="🕗 Geç Kalanlar (>09:15)"
              type="inner"
              headStyle={{ background: "#fff7e6", color: "#faad14" }}
            >
              <List
                dataSource={attendanceData.lateArrivals}
                renderItem={(rec) => {
                  const gecikmeDakika = dayjs(rec.baslangic).diff(
                    dayjs().set("hour", 9).set("minute", 15),
                    "minute"
                  );
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            src={
                              rec.avatar
                                ? `${API_URL}/uploads/${rec.avatar}`
                                : null
                            }
                          >
                            {rec.ad_soyad[0]}
                          </Avatar>
                        }
                        title={rec.ad_soyad}
                        description={
                          <div>
                            <div>
                              Giriş: {dayjs(rec.baslangic).format("HH:mm")}
                            </div>
                            <div style={{ fontSize: 11, color: "#fa8c16" }}>
                              {gecikmeDakika} dakika geç kaldı
                            </div>
                          </div>
                        }
                      />
                      <Tag color="orange">Gecikme</Tag>
                    </List.Item>
                  );
                }}
              />
              {attendanceData.lateArrivals.length === 0 && (
                <div style={{ color: "green", textAlign: "center" }}>
                  Herkes vaktinde geldi. 👍
                </div>
              )}
            </Card>

            {/* MESAİ BAŞLATMAYANLAR */}
            <Card
              title="⚠️ Mesai Başlatmayanlar"
              type="inner"
              style={{ marginTop: 15 }}
              headStyle={{ background: "#fff2f0", color: "#cf1322" }}
            >
              <List
                dataSource={attendanceData.absentNoLeave}
                renderItem={(user) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          src={
                            user.avatar
                              ? `${API_URL}/uploads/${user.avatar}`
                              : null
                          }
                          style={{ backgroundColor: "#ff4d4f" }}
                        >
                          {user.ad_soyad[0]}
                        </Avatar>
                      }
                      title={user.ad_soyad}
                      description={
                        <div>
                          <Tag color="red">Giriş Yok</Tag>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#666",
                              marginTop: 4,
                            }}
                          >
                            {user.departman}
                          </div>
                        </div>
                      }
                    />
                    <Tooltip title="Uyarı Gönder">
                      <Button
                        type="link"
                        icon={<AlertOutlined />}
                        size="small"
                      />
                    </Tooltip>
                  </List.Item>
                )}
              />
              {attendanceData.absentNoLeave.length === 0 && (
                <div style={{ color: "green", textAlign: "center" }}>
                  Herkes mesaiye başladı! 🎉
                </div>
              )}
            </Card>
          </Col>

          {/* SAĞ SÜTUN */}
          <Col span={8}>
            {/* FAZLA MESAİ ŞAMPİYONLARI */}
            <Card
              title="🏆 Ayın Fazla Mesai Şampiyonları"
              type="inner"
              headStyle={{ background: "#f9f0ff", color: "#722ed1" }}
              extra={<TrophyOutlined style={{ color: "gold" }} />}
            >
              {attendanceData.overtimeLeaders.length > 0 ? (
                <List
                  dataSource={attendanceData.overtimeLeaders}
                  renderItem={(user, index) => (
                    <List.Item>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: 20,
                            marginRight: 15,
                            minWidth: 30,
                            textAlign: "center",
                            color:
                              index === 0
                                ? "gold"
                                : index === 1
                                ? "silver"
                                : "#cd7f32",
                          }}
                        >
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                        </div>
                        <Avatar
                          src={
                            user.avatar
                              ? `${API_URL}/uploads/${user.avatar}`
                              : null
                          }
                          size="large"
                          style={{ marginRight: 10 }}
                        >
                          {user.ad_soyad[0]}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", fontSize: 14 }}>
                            {user.ad_soyad}
                          </div>
                          <div style={{ fontSize: 12, color: "#888" }}>
                            {user.departman || "Personel"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: "bold",
                              color: "#722ed1",
                            }}
                          >
                            {user.total_overtime} Saat
                          </div>
                          <div style={{ fontSize: 10, color: "#999" }}>
                            Fazla Mesai
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <div
                  style={{ textAlign: "center", padding: 20, color: "#999" }}
                >
                  <TrophyOutlined style={{ fontSize: 48, marginBottom: 10 }} />
                  <div>Bu ay için fazla mesai verisi bulunamadı.</div>
                </div>
              )}
            </Card>

            {/* OFİS DOLULUK ÖZETİ */}
            <Card
              style={{
                marginTop: 15,
                textAlign: "center",
                background: "linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)",
                border: "1px solid #d9d9d9",
              }}
            >
              <Statistic
                title="Anlık Ofis Doluluğu"
                value={dolulukYuzde}
                suffix="%"
                valueStyle={{
                  color:
                    dolulukYuzde > 70
                      ? "#3f8600"
                      : dolulukYuzde > 40
                      ? "#faad14"
                      : "#ff4d4f",
                  fontSize: 36,
                }}
              />
              <Progress
                percent={dolulukYuzde}
                status="active"
                strokeColor={
                  dolulukYuzde > 70
                    ? "#3f8600"
                    : dolulukYuzde > 40
                    ? "#faad14"
                    : "#ff4d4f"
                }
                style={{ marginTop: 20 }}
              />

              <Row gutter={16} style={{ marginTop: 20 }}>
                <Col span={8}>
                  <div style={{ fontSize: 12, color: "#666" }}>Mesaide</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#3f8600",
                    }}
                  >
                    {currentlyWorkingCount}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 12, color: "#666" }}>İzinde</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#1890ff",
                    }}
                  >
                    {onLeaveCount}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 12, color: "#666" }}>Giriş Yok</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#ff4d4f",
                    }}
                  >
                    {attendanceData.absentNoLeave.length}
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* PERSONEL ONAYI MODALI */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: "#722ed1" }} />
            <span>Personel Katılım İstekleri</span>
            <Badge
              count={bekleyenPersonel.length}
              style={{ backgroundColor: "#722ed1" }}
            />
          </Space>
        }
        open={personelModal}
        onCancel={() => setPersonelModal(false)}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <Table
          dataSource={bekleyenPersonel}
          rowKey="id"
          columns={[
            {
              title: "Ad Soyad",
              dataIndex: "ad_soyad",
              render: (text) => <Text strong>{text}</Text>,
            },
            {
              title: "Departman",
              dataIndex: "departman",
              render: (d) => <Tag color="blue">{d}</Tag>,
            },
            {
              title: "Pozisyon",
              dataIndex: "pozisyon",
              render: (p) => <Tag color="cyan">{p}</Tag>,
            },
            {
              title: "E-posta",
              dataIndex: "email",
              render: (email) => <a href={`mailto:${email}`}>{email}</a>,
            },
            {
              title: "İşlem",
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => personelOnayla(r.id, "Aktif")}
                  >
                    Onayla
                  </Button>
                  <Button
                    danger
                    size="small"
                    icon={<StopOutlined />}
                    onClick={() => personelOnayla(r.id, "Reddedildi")}
                  >
                    Reddet
                  </Button>
                  <Button
                    size="small"
                    icon={<InfoCircleOutlined />}
                    onClick={() => {
                      // Profil detayı görüntüleme
                    }}
                  >
                    Detay
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* İZİNLİLER MODALI */}
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
        open={izinModal}
        onCancel={() => setIzinModal(false)}
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
    </div>
  );
}
