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
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#FF4D4F"];

export default function AdminDashboard() {
  const [veri, setVeri] = useState(null);

  // Modallar
  const [finansModal, setFinansModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [projeModal, setProjeModal] = useState(false);
  const [personelModal, setPersonelModal] = useState(false);
  const [mesaiModal, setMesaiModal] = useState(false); // New Modal for Attendance

  // Detay Verileri
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);

  // New State for Attendance Data
  const [attendanceData, setAttendanceData] = useState({
    lateArrivals: [],
    absentNoLeave: [],
    overtimeLeaders: [],
    currentlyWorking: 0,
    totalStaff: 0,
  });

  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  useEffect(() => {
    verileriGetir();
    fetchAttendanceAnalytics();
  }, []);

  const verileriGetir = () => {
    // 1. Özet Veriler
    fetch(`${API_URL}/dashboard/ozet`)
      .then((res) => res.json())
      .then((data) => setVeri(data));

    // 2. Personel Onay Listesi (Bağımsız)
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBekleyenPersonel(
            data.filter((u) => u.hesap_durumu === "Bekliyor")
          );
        }
      });
  };

  // FETCH ATTENDANCE ANALYTICS (Mocking complex logic here, ideally backend provides this)
  const fetchAttendanceAnalytics = async () => {
    try {
      // 1. Get all users
      const usersRes = await fetch(`${API_URL}/ik/kullanicilar`);
      const users = await usersRes.json();

      // 2. Get today's attendance
      // Note: You might need to create a specific endpoint for 'daily overview' in backend
      // For now, we simulate by fetching history for everyone (inefficient but works for demo)
      // In production: GET /mesai/daily-summary
      const mesaiRes = await fetch(`${API_URL}/mesai/gecmis?tumu=true`);
      const mesaiRecs = await mesaiRes.json();

      // 3. Get active leaves (already available via dashboard/ozet but let's fetch details)
      const izinRes = await fetch(`${API_URL}/ik/izinler`);
      const izinler = await izinRes.json();

      const today = dayjs().format("YYYY-MM-DD");

      // Logic
      const todaysRecords = mesaiRecs.filter(
        (m) => dayjs(m.baslangic).format("YYYY-MM-DD") === today
      );
      const onLeaveToday = izinler.filter(
        (i) =>
          i.durum === "Onaylandı" &&
          today >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          today <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );

      const activeStaffCount = users.length; // Total active staff
      const currentlyClockedIn = todaysRecords.filter((r) => !r.bitis).length;

      // Find Late Arrivals (Started after 09:15)
      const lateArrivals = todaysRecords.filter((r) => {
        const start = dayjs(r.baslangic);
        return start.hour() > 9 || (start.hour() === 9 && start.minute() > 15);
      });

      // Find Absent but NOT on Leave (The "Ghost" list)
      const clockedInIds = todaysRecords.map((r) => r.kullanici_id);
      const onLeaveIds = onLeaveToday.map((i) => {
        // Need to map name to ID, assuming name is unique for demo or better use ID in permissions table
        const u = users.find((user) => user.ad_soyad === i.talep_eden);
        return u ? u.id : null;
      });

      const absentNoLeave = users.filter(
        (u) =>
          u.hesap_durumu === "Aktif" &&
          !clockedInIds.includes(u.id) &&
          !onLeaveIds.includes(u.id)
      );

      // Mock Overtime Leaders (calculating from history)
      // Normally backend does SUM(sure_dakika) GROUP BY user
      const overtimeLeaders = users
        .slice(0, 3)
        .map((u) => ({
          // Fake data for demo visual
          ad_soyad: u.ad_soyad,
          avatar: u.avatar,
          total_overtime: Math.floor(Math.random() * 10) + 2, // Random hours
        }))
        .sort((a, b) => b.total_overtime - a.total_overtime);

      setAttendanceData({
        lateArrivals,
        absentNoLeave,
        overtimeLeaders,
        currentlyWorking: currentlyClockedIn,
        totalStaff: activeStaffCount,
      });
    } catch (e) {
      console.error("Attendance fetch error", e);
    }
  };

  // --- DETAY ÇEKME FONKSİYONLARI ---
  const finansDetayGoster = () => {
    fetch(`${API_URL}/finans?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        setFinansDetay(data.filter((d) => d.durum.includes("Bekliyor")));
        setFinansModal(true);
      });
  };

  const izinDetayGoster = () => {
    fetch(`${API_URL}/ik/izinler?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        const bugun = dayjs().format("YYYY-MM-DD");
        // Tarih aralığında bugün var mı?
        const bugunYoklar = data.filter(
          (i) =>
            i.durum.includes("Onaylandı") &&
            bugun >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
            bugun <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
        );
        setIzinDetay(bugunYoklar);
        setIzinModal(true);
      });
  };

  const personelOnayla = (id, karar) => {
    fetch(`${API_URL}/auth/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: karar }),
    }).then(() => {
      message.success(`Personel ${karar} edildi.`);
      verileriGetir(); // Her şeyi yenile
    });
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

  return (
    <div style={{ paddingBottom: 50 }}>
      {/* 1. ÜST KARTLAR (KPI) */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card
            hoverable
            onClick={finansDetayGoster}
            style={{ borderTop: "3px solid #faad14" }}
          >
            <Statistic
              title="Onay Bekleyen Ödemeler"
              value={veri.finans.toplamTutar}
              precision={2}
              prefix={<DollarOutlined />}
              suffix={veri.finans.paraBirimi}
              valueStyle={{ color: "#faad14" }}
            />
            <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
              {veri.finans.bekleyenAdet} adet talep bekliyor
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card
            hoverable
            onClick={() => setRiskModal(true)}
            style={{ borderTop: "3px solid #ff4d4f" }}
          >
            <Statistic
              title="Acil / Geciken İşler"
              value={veri.riskliIsler.length}
              prefix={<AlertOutlined />}
              valueStyle={{ color: "#ff4d4f" }}
            />
            <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
              Teslimi yaklaşan veya geçen
            </div>
          </Card>
        </Col>

        {/* NEW: Attendance Summary Card */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setMesaiModal(true)}
            style={{ borderTop: "3px solid #722ed1" }}
          >
            <Statistic
              title="Ofis Doluluk Oranı"
              value={attendanceData.currentlyWorking}
              suffix={`/ ${attendanceData.totalStaff}`}
              prefix={<FieldTimeOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
            <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
              {attendanceData.absentNoLeave.length} kişi mesai başlatmadı! ⚠️
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card hoverable style={{ borderTop: "3px solid #52c41a" }}>
            <Statistic
              title="Başarı Oranı"
              value={
                veri.toplamGorev > 0
                  ? Math.round((veri.bitenIsler / veri.toplamGorev) * 100)
                  : 0
              }
              prefix={<RiseOutlined />}
              suffix="%"
              valueStyle={{ color: "#52c41a" }}
            />
            <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
              Toplam {veri.bitenIsler} iş tamamlandı
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. PERSONEL ONAY UYARISI (Varsa Göster) */}
      {bekleyenPersonel.length > 0 && (
        <AlertOutlined
          style={{ fontSize: 24, color: "#722ed1", margin: "20px 0 10px 0" }}
        />
      )}
      {bekleyenPersonel.length > 0 && (
        <Button
          type="dashed"
          block
          style={{ marginBottom: 20, borderColor: "#722ed1", color: "#722ed1" }}
          onClick={() => setPersonelModal(true)}
        >
          ⚠️ {bekleyenPersonel.length} yeni personel onayı bekliyor. İncelemek
          için tıklayın.
        </Button>
      )}

      {/* 3. GRAFİKLER VE DETAYLI LİSTELER */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/* A. PROJE İLERLEME DURUMLARI (Progress Bar Geri Geldi!) */}
        <Col span={14}>
          <Card
            title={
              <span>
                <ProjectOutlined /> Proje İlerleme Durumları
              </span>
            }
            extra={
              <Button type="link" onClick={() => setProjeModal(true)}>
                Detay
              </Button>
            }
          >
            <List
              dataSource={veri.projeIlerleme}
              renderItem={(item) => {
                const toplam = parseInt(item.toplam_is) || 1;
                const biten = parseInt(item.biten_is) || 0;
                const yuzde = Math.round((biten / toplam) * 100);
                return (
                  <div style={{ marginBottom: 15 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.ad}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>
                        {biten} / {toplam} Görev
                      </span>
                    </div>
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
                    />
                  </div>
                );
              }}
            />
            {veri.projeIlerleme.length === 0 && (
              <div style={{ textAlign: "center", color: "#ccc" }}>
                Henüz proje yok
              </div>
            )}
          </Card>
        </Col>

        {/* B. GÖREV DURUM DAĞILIMI (Pasta Grafik) */}
        <Col span={10}>
          <Card title="Görev Dağılımı" style={{ height: "100%" }}>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pastaVerisi}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pastaVerisi.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* --- MODALLAR --- */}

      {/* 1. FİNANS DETAYI */}
      <Modal
        title="Onay Bekleyen Ödemeler"
        open={finansModal}
        onCancel={() => setFinansModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={finansDetay}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            { title: "Talep Eden", dataIndex: "talep_eden" },
            { title: "Başlık", dataIndex: "baslik", render: (t) => <b>{t}</b> },
            {
              title: "Tutar",
              render: (_, r) => (
                <Tag color="gold" style={{ fontSize: 14 }}>
                  {r.tutar} {r.para_birimi}
                </Tag>
              ),
            },
            {
              title: "Departman",
              dataIndex: "departman",
              render: (d) => <Tag>{d}</Tag>,
            },
            {
              title: "Durum",
              dataIndex: "durum",
              render: (d) => <Tag color="processing">{d}</Tag>,
            },
          ]}
        />
      </Modal>

      {/* 2. RİSKLİ İŞLER DETAYI (Gecikenler) */}
      <Modal
        title="Acil & Geciken İşler"
        open={riskModal}
        onCancel={() => setRiskModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={veri.riskliIsler}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: "İş Başlığı",
              dataIndex: "baslik",
              render: (t) => <b>{t}</b>,
            },
            {
              title: "Sorumlular",
              dataIndex: "atananlar",
              render: (a) => (a ? a.join(", ") : "-"),
            },
            {
              title: "Teslim Tarihi",
              dataIndex: "tarih",
              render: (t) => {
                const tarih = dayjs(t);
                const gecikmis = tarih.isBefore(dayjs(), "day");
                const kalanGun = tarih.diff(dayjs(), "day");
                return (
                  <Tag color={gecikmis ? "red" : "orange"}>
                    {tarih.format("DD.MM.YYYY")} (
                    {gecikmis ? "GECİKTİ" : `${kalanGun} gün kaldı`})
                  </Tag>
                );
              },
            },
          ]}
        />
      </Modal>

      {/* 3. İZİNLİLER DETAYI */}
      <Modal
        title="Bugün Ofiste Olmayanlar"
        open={izinModal}
        onCancel={() => setIzinModal(false)}
        footer={null}
      >
        <List
          itemLayout="horizontal"
          dataSource={izinDetay}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <UserAddOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                }
                title={item.talep_eden}
                description={
                  <span>
                    {item.tur} —{" "}
                    <b>{dayjs(item.bitis_tarihi).format("DD.MM.YYYY")}</b>{" "}
                    tarihinde dönüyor.
                  </span>
                }
              />
            </List.Item>
          )}
        />
        {izinDetay.length === 0 && (
          <div style={{ textAlign: "center", padding: 20 }}>
            Bugün herkes ofiste! 🎉
          </div>
        )}
      </Modal>

      {/* 5. MESAİ / ATTENDANCE ANALYTICS MODAL (YENİ) */}
      <Modal
        title={
          <Space>
            <ClockCircleOutlined /> Günlük Mesai Özeti & Analiz
          </Space>
        }
        open={mesaiModal}
        onCancel={() => setMesaiModal(false)}
        footer={null}
        width={900}
      >
        <Row gutter={[16, 16]}>
          {/* Sol: Geç Kalanlar & Başlatmayanlar */}
          <Col span={12}>
            <Card
              title="⚠️ Mesai Başlatmayanlar (Ofiste Yok?)"
              type="inner"
              headStyle={{ color: "#cf1322" }}
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
                        >
                          {user.ad_soyad[0]}
                        </Avatar>
                      }
                      title={user.ad_soyad}
                      description={<Tag color="red">Giriş Yok</Tag>}
                    />
                    <Tooltip title="Ara / Mesaj At">
                      <Button type="link" icon={<AlertOutlined />} />
                    </Tooltip>
                  </List.Item>
                )}
              />
              {attendanceData.absentNoLeave.length === 0 && (
                <div style={{ color: "green", textAlign: "center" }}>
                  Herkes mesaiye başladı!
                </div>
              )}
            </Card>

            <Card
              title="🕗 Geç Kalanlar (>09:15)"
              type="inner"
              style={{ marginTop: 15 }}
              headStyle={{ color: "#faad14" }}
            >
              <List
                dataSource={attendanceData.lateArrivals}
                renderItem={(rec) => (
                  <List.Item>
                    <List.Item.Meta
                      title={rec.ad_soyad} // Backend should join user name
                      description={`Giriş: ${dayjs(rec.baslangic).format(
                        "HH:mm"
                      )}`}
                    />
                    <Tag color="orange">Gecikme</Tag>
                  </List.Item>
                )}
              />
              {attendanceData.lateArrivals.length === 0 && (
                <div style={{ color: "green", textAlign: "center" }}>
                  Herkes vaktinde geldi.
                </div>
              )}
            </Card>
          </Col>

          {/* Sağ: Fazla Mesai Liderleri */}
          <Col span={12}>
            <Card
              title="🔥 Bu Ayın Fazla Mesai Liderleri"
              type="inner"
              headStyle={{ color: "#722ed1" }}
            >
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
                          fontSize: 16,
                          marginRight: 15,
                          color:
                            index === 0
                              ? "gold"
                              : index === 1
                              ? "silver"
                              : "#cd7f32",
                        }}
                      >
                        #{index + 1}
                      </div>
                      <Avatar
                        src={
                          user.avatar
                            ? `${API_URL}/uploads/${user.avatar}`
                            : null
                        }
                        style={{ marginRight: 10 }}
                      >
                        {user.ad_soyad[0]}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold" }}>
                          {user.ad_soyad}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {user.departman || "Personel"}
                        </div>
                      </div>
                      <Tag color="purple">{user.total_overtime} Saat</Tag>
                    </div>
                  </List.Item>
                )}
              />
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#999",
                  textAlign: "center",
                }}
              >
                * 09:00 - 18:00 dışındaki çalışmalar baz alınmıştır.
              </div>
            </Card>

            {/* Anlık Doluluk */}
            <Card
              style={{
                marginTop: 15,
                textAlign: "center",
                background: "#f9f9f9",
              }}
            >
              <Statistic
                title="Anlık Ofis Doluluğu"
                value={attendanceData.currentlyWorking}
                suffix={`/ ${attendanceData.totalStaff}`}
                valueStyle={{ color: "#3f8600" }}
              />
              <Progress
                percent={Math.round(
                  (attendanceData.currentlyWorking /
                    attendanceData.totalStaff) *
                    100
                )}
                status="active"
                strokeColor="#3f8600"
              />
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* 4. PERSONEL ONAYI */}
      <Modal
        title="Personel Katılım İstekleri"
        open={personelModal}
        onCancel={() => setPersonelModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={bekleyenPersonel}
          rowKey="id"
          columns={[
            { title: "Ad Soyad", dataIndex: "ad_soyad" },
            { title: "Departman", dataIndex: "departman" },
            { title: "Pozisyon", dataIndex: "pozisyon" },
            {
              title: "İşlem",
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => personelOnayla(r.id, "Aktif")}
                  >
                    Onayla
                  </Button>
                  <Button
                    danger
                    size="small"
                    onClick={() => personelOnayla(r.id, "Reddedildi")}
                  >
                    Reddet
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
