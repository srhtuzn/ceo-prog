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

  // Detay Verileri
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);

  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  useEffect(() => {
    verileriGetir();
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

        <Col span={6}>
          <Card
            hoverable
            onClick={izinDetayGoster}
            style={{ borderTop: "3px solid #1890ff" }}
          >
            <Statistic
              title="Bugün İzinli"
              value={veri.bugunIzinli}
              prefix={<TeamOutlined />}
              suffix="Kişi"
              valueStyle={{ color: "#1890ff" }}
            />
            <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
              Ofiste olmayan personel
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
